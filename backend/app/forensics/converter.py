import fitz  # PyMuPDF
import os
from PIL import Image
import io

class DocumentConverter:
    """
    Converts PDFs and DOCX files into high-resolution images for unified forensic visualization.
    """
    @staticmethod
    def pdf_to_images(pdf_path, output_dir, dpi=300):
        """
        Converts each page of a PDF into a high-res PNG.
        Returns a list of absolute paths to the generated images.
        """
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            
        doc = fitz.open(pdf_path)
        image_paths = [] 
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72))
            
            output_filename = f"page_{page_num}.png"
            output_path = os.path.join(output_dir, output_filename)
            
            pix.save(output_path)
            image_paths.append(os.path.abspath(output_path))
            
        doc.close()
        return image_paths

    @staticmethod
    def docx_to_images(docx_path, output_dir):
        """
        Converts a DOCX file to images. 
        Note: DOCX to Image usually requires a middle step (PDF or rendering).
        We'll use a simplified placeholder or a lightweight rendering approach if possible.
        For now, we'll focus on PDF as it's the primary bank statement format.
        """
        # Placeholder for DOCX support using python-docx to PDF then to images
        # This requires LibreOffice or similar on the system for high fidelity.
        # For this implementation, we'll implement a fallback message or basic text rendering.
        return []

    @staticmethod
    def get_document_pages(file_path, storage_dir):
        """
        Standardized entry point for all file types.
        Returns list of image paths for the document.
        """
        ext = file_path.lower().split(".")[-1]
        doc_id = os.path.basename(file_path).split(".")[0]
        output_dir = os.path.join(storage_dir, f"converted_{doc_id}")
        
        if ext == "pdf":
            return DocumentConverter.pdf_to_images(file_path, output_dir)
        elif ext in ["jpg", "jpeg", "png"]:
            return [os.path.abspath(file_path)]
        else:
            # Fallback or error
            return []
