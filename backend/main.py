import os
import re
import tempfile
import shutil
import base64
import asyncio
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import torch
from transformers import AutoModel, AutoTokenizer
from PIL import Image
import uvicorn
from decouple import config as env_config

# Import PDF and document conversion utilities
from pdf_utils import (
    pdf_to_images_high_quality,
    images_to_pdf,
    extract_ref_patterns,
    crop_images_from_refs,
    clean_markdown_content
)
from format_converter import DocumentConverter

# -----------------------------
# Model lifecycle / device management
# -----------------------------
model = None
tokenizer = None
model_status = "loading_cpu"
model_message = "Starting model load into CPU memory"
model_lock = asyncio.Lock()


def _cuda_memory_mb():
    if not torch.cuda.is_available():
        return 0, 0
    return (
        round(torch.cuda.memory_allocated() / 1024 / 1024, 1),
        round(torch.cuda.memory_reserved() / 1024 / 1024, 1),
    )


def _model_device() -> str:
    if model is None:
        return "none"
    try:
        return str(next(model.parameters()).device)
    except Exception:
        return "unknown"


def _move_model(target: str):
    global model
    if model is None:
        raise RuntimeError("Model has not been loaded")
    model.to(target)
    model.eval()
    if target == "cpu" and torch.cuda.is_available():
        torch.cuda.empty_cache()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model into CPU RAM on startup; GPU use is controlled manually."""
    global model, tokenizer, model_status, model_message

    os.environ.pop("TRANSFORMERS_CACHE", None)
    MODEL_NAME = env_config("MODEL_NAME", default="deepseek-ai/DeepSeek-OCR")
    HF_HOME = env_config("HF_HOME", default="/models")
    os.makedirs(HF_HOME, exist_ok=True)

    try:
        model_status = "loading_cpu"
        model_message = f"Loading {MODEL_NAME} into CPU memory"
        print(f"🚀 Loading {MODEL_NAME} into CPU memory...")
        torch_dtype = torch.bfloat16

        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
        )

        model = AutoModel.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
            use_safetensors=True,
            attn_implementation="eager",
            torch_dtype=torch_dtype,
        ).eval().to("cpu")

        try:
            if getattr(tokenizer, "pad_token_id", None) is None and getattr(tokenizer, "eos_token_id", None) is not None:
                tokenizer.pad_token = tokenizer.eos_token
            if getattr(model.config, "pad_token_id", None) is None and getattr(tokenizer, "pad_token_id", None) is not None:
                model.config.pad_token_id = tokenizer.pad_token_id
        except Exception:
            pass

        model_status = "cpu_ready"
        model_message = "Model is ready in CPU memory. Load it to GPU before OCR."
        print("✅ Model loaded into CPU memory. GPU memory remains free until requested.")
    except Exception as e:
        model_status = "error"
        model_message = f"Model load failed: {type(e).__name__}"
        print(f"❌ Model load failed: {type(e).__name__}: {e}")
        raise

    yield

    print("🛑 Shutting down...")

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(
    title="DeepSeek-OCR API",
    description="Blazing fast OCR with DeepSeek-OCR model 🔥",
    version="2.1.0",
    lifespan=lifespan
)

# CORS middleware for React frontend
CORS_ORIGINS = env_config("CORS_ORIGINS", default="").split(",")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://localhost:30330"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# -----------------------------
# Prompt builder
# -----------------------------
def build_prompt(
    mode: str,
    user_prompt: str,
    grounding: bool,
    find_term: Optional[str],
    schema: Optional[str],
    include_caption: bool,
) -> str:
    """Build the prompt based on mode"""
    parts: List[str] = ["<image>"]
    mode_requires_grounding = mode in {"find_ref", "layout_map", "pii_redact"}
    if grounding or mode_requires_grounding:
        parts.append("<|grounding|>")

    instruction = ""
    if mode == "plain_ocr":
        instruction = "Free OCR."
    elif mode == "markdown":
        instruction = "Convert the document to markdown."
    elif mode == "tables_csv":
        instruction = (
            "Extract every table and output CSV only. "
            "Use commas, minimal quoting. If multiple tables, separate with a line containing '---'."
        )
    elif mode == "tables_md":
        instruction = "Extract every table as GitHub-flavored Markdown tables. Output only the tables."
    elif mode == "kv_json":
        schema_text = schema.strip() if schema else "{}"
        instruction = (
            "Extract key fields and return strict JSON only. "
            f"Use this schema (fill the values): {schema_text}"
        )
    elif mode == "figure_chart":
        instruction = (
            "Parse the figure. First extract any numeric series as a two-column table (x,y). "
            "Then summarize the chart in 2 sentences. Output the table, then a line '---', then the summary."
        )
    elif mode == "find_ref":
        key = (find_term or "").strip() or "Total"
        instruction = f"Locate <|ref|>{key}<|/ref|> in the image."
    elif mode == "layout_map":
        instruction = (
            'Return a JSON array of blocks with fields {"type":["title","paragraph","table","figure"],'
            '"box":[x1,y1,x2,y2]}. Do not include any text content.'
        )
    elif mode == "pii_redact":
        instruction = (
            'Find all occurrences of emails, phone numbers, postal addresses, and IBANs. '
            'Return a JSON array of objects {label, text, box:[x1,y1,x2,y2]}.'
        )
    elif mode == "multilingual":
        instruction = "Free OCR. Detect the language automatically and output in the same script."
    elif mode == "describe":
        instruction = "Describe this image. Focus on visible key elements."
    elif mode == "freeform":
        instruction = user_prompt.strip() if user_prompt else "OCR this image."
    else:
        instruction = "OCR this image."

    if include_caption and mode not in {"describe"}:
        instruction = instruction + "\nThen add a one-paragraph description of the image."

    parts.append(instruction)
    return "\n".join(parts)

# -----------------------------
# Grounding parser
# -----------------------------
DET_BLOCK = re.compile(
    r"<\|ref\|>(?P<label>.*?)<\|/ref\|>\s*<\|det\|>\s*(?P<coords>\[.*\])\s*<\|/det\|>",
    re.DOTALL,
)

def clean_grounding_text(text: str) -> str:
    """Remove grounding tags from text for display, keeping labels"""
    cleaned = re.sub(
        r"<\|ref\|>(.*?)<\|/ref\|>\s*<\|det\|>\s*\[.*\]\s*<\|/det\|>",
        r"\1",
        text,
        flags=re.DOTALL,
    )
    cleaned = re.sub(r"<\|grounding\|>", "", cleaned)
    return cleaned.strip()

def parse_detections(text: str, image_width: int, image_height: int) -> List[Dict[str, Any]]:
    """Parse grounding boxes from text and scale from 0-999 normalized coords to actual image dimensions."""
    boxes: List[Dict[str, Any]] = []
    for m in DET_BLOCK.finditer(text or ""):
        label = m.group("label").strip()
        coords_str = m.group("coords").strip()

        print(f"🔍 DEBUG: Found detection for '{label}'")
        print(f"📦 Raw coords string (with brackets): {coords_str}")

        try:
            import ast
            parsed = ast.literal_eval(coords_str)

            if (
                isinstance(parsed, list)
                and len(parsed) == 4
                and all(isinstance(n, (int, float)) for n in parsed)
            ):
                box_coords = [parsed]
                print("📦 Single box (flat list) detected")
            elif isinstance(parsed, list):
                box_coords = parsed
                print(f"📦 Boxes detected: {len(box_coords)}")
            else:
                raise ValueError("Unsupported coords structure")

            for idx, box in enumerate(box_coords):
                if isinstance(box, (list, tuple)) and len(box) >= 4:
                    x1 = int(float(box[0]) / 999 * image_width)
                    y1 = int(float(box[1]) / 999 * image_height)
                    x2 = int(float(box[2]) / 999 * image_width)
                    y2 = int(float(box[3]) / 999 * image_height)
                    print(f"  Box {idx+1}: {box} → [{x1}, {y1}, {x2}, {y2}]")
                    boxes.append({"label": label, "box": [x1, y1, x2, y2]})
                else:
                    print(f"  ⚠️ Skipping invalid box: {box}")
        except Exception as e:
            print(f"❌ Parsing failed: {e}")
            continue

    print(f"🎯 Total boxes parsed: {len(boxes)}")
    return boxes

# -----------------------------
# Routes
# -----------------------------
@app.get("/")
async def root():
    return {"message": "DeepSeek-OCR API is running! 🚀", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None, "model_status": model_status}

@app.get("/api/model/status")
async def get_model_status():
    allocated, reserved = _cuda_memory_mb()
    return {
        "status": model_status,
        "message": model_message,
        "device": _model_device(),
        "cuda_available": torch.cuda.is_available(),
        "cuda_allocated_mb": allocated,
        "cuda_reserved_mb": reserved,
    }

@app.post("/api/model/load-gpu")
async def load_model_to_gpu():
    global model_status, model_message
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="模型尚未加载到内存")
    if not torch.cuda.is_available():
        raise HTTPException(status_code=503, detail="CUDA 不可用，无法加载到 GPU")

    async with model_lock:
        if _model_device().startswith("cuda"):
            model_status = "gpu_ready"
            model_message = "Model is already on GPU"
            return await get_model_status()

        model_status = "loading_gpu"
        model_message = "Moving model from CPU memory to GPU"
        try:
            await asyncio.to_thread(_move_model, "cuda")
            model_status = "gpu_ready"
            model_message = "Model is ready on GPU"
        except Exception as e:
            model_status = "error"
            model_message = f"GPU load failed: {type(e).__name__}"
            raise HTTPException(status_code=500, detail="模型加载到 GPU 失败")

    return await get_model_status()

@app.post("/api/model/offload-cpu")
async def offload_model_to_cpu():
    global model_status, model_message
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="模型尚未加载")

    async with model_lock:
        if _model_device().startswith("cpu"):
            model_status = "cpu_ready"
            model_message = "Model is already in CPU memory"
            return await get_model_status()

        model_status = "offloading_cpu"
        model_message = "Moving model from GPU to CPU memory"
        try:
            await asyncio.to_thread(_move_model, "cpu")
            model_status = "cpu_ready"
            model_message = "Model is stored in CPU memory; GPU memory has been released"
        except Exception as e:
            model_status = "error"
            model_message = f"CPU offload failed: {type(e).__name__}"
            raise HTTPException(status_code=500, detail="模型卸载到内存失败")

    return await get_model_status()


def require_gpu_ready():
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="模型尚未加载")
    if model_status != "gpu_ready" or not _model_device().startswith("cuda"):
        raise HTTPException(status_code=503, detail="模型当前位于 CPU 内存，请先点击“加载到 GPU”")

@app.post("/api/ocr")
async def ocr_inference(
    image: UploadFile = File(...),
    mode: str = Form("plain_ocr"),
    prompt: str = Form(""),
    grounding: bool = Form(False),
    include_caption: bool = Form(False),
    find_term: Optional[str] = Form(None),
    schema: Optional[str] = Form(None),
    base_size: int = Form(1024),
    image_size: int = Form(640),
    crop_mode: bool = Form(True),
    test_compress: bool = Form(False),
):
    """Perform OCR inference on uploaded image."""
    require_gpu_ready()

    prompt_text = build_prompt(
        mode=mode,
        user_prompt=prompt,
        grounding=grounding,
        find_term=find_term,
        schema=schema,
        include_caption=include_caption,
    )

    tmp_img = None
    out_dir = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            content = await image.read()
            tmp.write(content)
            tmp_img = tmp.name

        try:
            with Image.open(tmp_img) as im:
                orig_w, orig_h = im.size
        except Exception:
            orig_w = orig_h = None

        out_dir = tempfile.mkdtemp(prefix="dsocr_")

        res = model.infer(
            tokenizer,
            prompt=prompt_text,
            image_file=tmp_img,
            output_path=out_dir,
            base_size=base_size,
            image_size=image_size,
            crop_mode=crop_mode,
            save_results=False,
            test_compress=test_compress,
            eval_mode=True,
        )

        if isinstance(res, str):
            text = res.strip()
        elif isinstance(res, dict) and "text" in res:
            text = str(res["text"]).strip()
        elif isinstance(res, (list, tuple)):
            text = "\n".join(map(str, res)).strip()
        else:
            text = ""

        if not text:
            mmd = os.path.join(out_dir, "result.mmd")
            if os.path.exists(mmd):
                with open(mmd, "r", encoding="utf-8") as fh:
                    text = fh.read().strip()
        if not text:
            text = "No text returned by model."

        boxes = parse_detections(text, orig_w or 1, orig_h or 1) if ("<|det|>" in text or "<|ref|>" in text) else []
        display_text = clean_grounding_text(text) if ("<|ref|>" in text or "<|grounding|>" in text) else text

        if not display_text and boxes:
            display_text = ", ".join([b["label"] for b in boxes])

        return JSONResponse({
            "success": True,
            "text": display_text,
            "raw_text": text,
            "boxes": boxes,
            "image_dims": {"w": orig_w, "h": orig_h},
            "metadata": {
                "mode": mode,
                "grounding": grounding or (mode in {"find_ref","layout_map","pii_redact"}),
                "base_size": base_size,
                "image_size": image_size,
                "crop_mode": crop_mode
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"OCR inference error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred during OCR processing.")

    finally:
        if tmp_img:
            try:
                os.remove(tmp_img)
            except Exception:
                pass
        if out_dir:
            shutil.rmtree(out_dir, ignore_errors=True)

@app.post("/api/process-pdf")
async def process_pdf(
    pdf_file: UploadFile = File(...),
    mode: str = Form("plain_ocr"),
    prompt: str = Form(""),
    output_format: str = Form("markdown"),
    grounding: bool = Form(False),
    include_caption: bool = Form(False),
    extract_images: bool = Form(True),
    dpi: int = Form(144),
    base_size: int = Form(1024),
    image_size: int = Form(640),
    crop_mode: bool = Form(True),
):
    """Process PDF document with OCR and convert to various formats."""
    require_gpu_ready()

    if output_format not in ["markdown", "html", "docx", "json"]:
        raise HTTPException(status_code=400, detail="Invalid output format. Must be: markdown, html, docx, or json")

    try:
        pdf_bytes = await pdf_file.read()

        print(f"📄 Converting PDF to images (DPI: {dpi})...")
        images = pdf_to_images_high_quality(pdf_bytes, dpi=dpi)
        total_pages = len(images)
        print(f"✅ Converted {total_pages} pages")

        pages_content = []
        converter = DocumentConverter()

        for page_idx, img in enumerate(images):
            print(f"🔍 Processing page {page_idx + 1}/{total_pages}...")

            prompt_text = build_prompt(
                mode=mode,
                user_prompt=prompt,
                grounding=grounding,
                find_term=None,
                schema=None,
                include_caption=include_caption,
            )

            tmp_img = None
            out_dir = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                    img.save(tmp, format="PNG")
                    tmp_img = tmp.name

                orig_w, orig_h = img.size
                out_dir = tempfile.mkdtemp(prefix="dsocr_pdf_")

                res = model.infer(
                    tokenizer,
                    prompt=prompt_text,
                    image_file=tmp_img,
                    output_path=out_dir,
                    base_size=base_size,
                    image_size=image_size,
                    crop_mode=crop_mode,
                    save_results=False,
                    test_compress=False,
                    eval_mode=True,
                )

                if isinstance(res, str):
                    text = res.strip()
                elif isinstance(res, dict) and "text" in res:
                    text = str(res["text"]).strip()
                elif isinstance(res, (list, tuple)):
                    text = "\n".join(map(str, res)).strip()
                else:
                    text = ""

                if not text:
                    mmd = os.path.join(out_dir, "result.mmd")
                    if os.path.exists(mmd):
                        with open(mmd, "r", encoding="utf-8") as fh:
                            text = fh.read().strip()
                if not text:
                    text = f"No text returned for page {page_idx + 1}."

                page_images = []
                if extract_images:
                    matches, matches_image, matches_other = extract_ref_patterns(text)
                    if matches_image:
                        cropped = crop_images_from_refs(img, matches)
                        for cropped_img in cropped:
                            img_buffer = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                            cropped_img.save(img_buffer.name, format="JPEG", quality=95)
                            with open(img_buffer.name, "rb") as f:
                                img_b64 = base64.b64encode(f.read()).decode('utf-8')
                                page_images.append(img_b64)
                            os.remove(img_buffer.name)

                        text = clean_markdown_content(text, matches_image, matches_other)
                        for img_idx in range(len(page_images)):
                            text = f"[IMAGE_{img_idx}]\n" + text

                boxes = parse_detections(text, orig_w, orig_h) if ("<|det|>" in text or "<|ref|>" in text) else []
                display_text = clean_grounding_text(text) if ("<|ref|>" in text or "<|grounding|>" in text) else text

                pages_content.append({
                    'page_number': page_idx + 1,
                    'text': display_text,
                    'raw_text': text,
                    'boxes': boxes,
                    'images': page_images,
                    'image_dims': {'w': orig_w, 'h': orig_h}
                })

            finally:
                if tmp_img:
                    try:
                        os.remove(tmp_img)
                    except Exception:
                        pass
                if out_dir:
                    shutil.rmtree(out_dir, ignore_errors=True)

        print(f"✅ Processed all {total_pages} pages")

        if output_format == "json":
            return JSONResponse({
                "success": True,
                "total_pages": total_pages,
                "pages": pages_content,
                "metadata": {
                    "mode": mode,
                    "grounding": grounding,
                    "extract_images": extract_images,
                    "dpi": dpi
                }
            })
        elif output_format == "markdown":
            md_content = converter.to_markdown(pages_content, include_images=extract_images)
            return StreamingResponse(
                iter([md_content.encode('utf-8')]),
                media_type="text/markdown",
                headers={"Content-Disposition": "attachment; filename=ocr_result.md"}
            )
        elif output_format == "html":
            html_content = converter.to_html(pages_content, include_images=extract_images)
            return StreamingResponse(
                iter([html_content.encode('utf-8')]),
                media_type="text/html",
                headers={"Content-Disposition": "attachment; filename=ocr_result.html"}
            )
        elif output_format == "docx":
            docx_buffer = converter.to_docx(pages_content, include_images=extract_images)
            return StreamingResponse(
                docx_buffer,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": "attachment; filename=ocr_result.docx"}
            )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error processing PDF: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An internal error occurred during PDF processing.")

if __name__ == "__main__":
    host = env_config("API_HOST", default="0.0.0.0")
    port = env_config("API_PORT", default=30380, cast=int)
    uvicorn.run(app, host=host, port=port)