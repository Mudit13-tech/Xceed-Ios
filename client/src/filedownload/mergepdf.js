import { PDFDocument } from 'pdf-lib';

function downloadMergedPdf(mergedPdfBytes, fileName) {
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    link.download = fileName;
    // The link has to be in the document for the download to fire reliably,
    // and the URL can only be revoked once the browser has picked it up.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 1000);

}

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
        downloadMergedPdf(mergedPdfBytes,fileName);
        // Do something with the merged PDF bytes, e.g., create a Blob, download, etc.
    } catch (error) {
        console.error('Error merging PDFs:', error);
        throw error;
    }
}

export default mergePdfs;
