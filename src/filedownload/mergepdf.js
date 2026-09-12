import { PDFDocument } from 'pdf-lib';
import { savePdfBytes } from './savePdf';

async function mergePdfs(buffer,fileName) {
    try {
        if (!buffer || buffer.length === 0) {
            throw new Error('No PDFs were generated to merge.');
        }

        const mergedPdfDoc = await PDFDocument.create();

        for (let i in buffer) {
            const pdfDoc1 = await PDFDocument.load(buffer[i]);
            const copiedPage = await mergedPdfDoc.copyPages(pdfDoc1,pdfDoc1.getPageIndices());
            for(let j in copiedPage){
                mergedPdfDoc.addPage(copiedPage[j]);
            }
        }

        if (mergedPdfDoc.getPageCount() === 0) {
            throw new Error('The merged PDF has no pages.');
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdfDoc.save();
        await savePdfBytes(mergedPdfBytes, fileName);
        // Do something with the merged PDF bytes, e.g., create a Blob, download, etc.
    } catch (error) {
        console.error('Error merging PDFs:', error);
        throw error;
    }
}

export default mergePdfs;
