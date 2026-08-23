import { useEffect, useRef, useState } from 'react';
import Bottom from './Bottom';
import Content from './Content';
import Top from './Top';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { Button } from '@chakra-ui/react';
import jsPDF from 'jspdf';
import { buildEmbeddedFontCss } from '../embedFonts';

function Template01() {
  const svgRef = useRef();
  const [imageDownloading, setImageDownloading] = useState(false)
  const [imageDownloaded, setImageDownloaded] = useState(false)
  const [pdfDownloading, setpdfDownloading] = useState(false)
  const [pdfDownloaded, setpdfDownloaded] = useState(false)

  useEffect(() => {
    const url = window.location.href; // Replace with your URL
    const svg = svgRef.current;

    QRCode.toDataURL(url, (err, dataUrl) => {
      if (err) throw err;

      const image = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'image'
      );
      image.setAttribute('x', '100');
      image.setAttribute('y', '500');
      image.setAttribute('width', '100');
      image.setAttribute('height', '100');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);

      svg.appendChild(image);
    });
  }, []);

  
  // async function saveDOMToHtmlFile(domElement) {
  //   try {
  //     const images = domElement.getElementsByTagName("img")
  //     // console.log(images)
  //     for (let i = 0; i < images.length; i++) {
  //       if (images[i].src) {
  //         const response = await fetchImageToDataURL(`${apiUrl}/proxy-image/?url=${images[i].src}`,images[i].src)
  //         // console.log(response);
  //         if (response && !(response == "error")) {
  //           console.log(images[i].src)
  //           const dataUrl = await response;
  //           images[i].src = dataUrl;
  //           // console.log(dataUrl);
  //         } else {
  //           images[i].remove()
  //         }
  //       } else {
  //         images[i].remove()
  //       }
  //     }
  //   } catch (error) {
  //     console.error(error)
  //   }
  //   const htmlString = domElement.outerHTML;
  //   const blob = new Blob([htmlString], { type: 'text/html' });
  //   const file = new File([blob], "Certificate", { type: "text/html" });
  //   return file;
  // }
  // The certificate is laid out at a fixed 841.9 x 595.5 CSS px. Capture the
  // wrapper itself rather than probing a child: the first child is a <style>
  // tag whenever the QR has been freely placed, and an <svg> otherwise, and
  // neither reports usable clientWidth/clientHeight in every browser.
  const renderCanvas = async () => {
    const host = document.getElementById('id-card-class');
    const source = host && host.firstElementChild;
    if (!source) {
      throw new Error('Certificate is still loading.');
    }

    // Webfonts that have not finished loading render as fallbacks in the
    // capture, so wait them out before rasterising.
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Waiting is not enough on its own: the capture is rasterised from an SVG
    // loaded as an image, which cannot fetch webfonts at all. Without this the
    // certificate renders in fallback fonts whose metrics differ, and every
    // centred and wrapped line lands somewhere other than where it sits on
    // screen. Embedding the faces as data URIs is what keeps the text put.
    const fontCss = await buildEmbeddedFontCss(source);

    // html2canvas derives its draw offset from the captured element's page
    // position, and on the foreignObject path applies that offset twice over —
    // once as a canvas translate, once inside drawImage — each time multiplied
    // by the scale. Zero is the only value it renders correctly; anything else
    // drags the capture off the canvas, which is what shifted the certificate
    // upward (it renders below the app header). Rather than predict that
    // offset and subtract it back out, capture a copy that actually sits at the
    // page origin: pinned at 0,0 and told the page is unscrolled, the offset is
    // zero by construction rather than by arithmetic. Working on a clone also
    // means the live certificate is never mutated mid-render.
    const stage = document.createElement('div');
    stage.style.cssText =
      'position:fixed;left:0;top:0;margin:0;padding:0;background:#fff;pointer-events:none;z-index:-1;';
    const clone = source.cloneNode(true);
    clone.style.margin = '0px';
    clone.style.padding = '0px';
    stage.appendChild(clone);
    document.body.appendChild(stage);

    try {
      const rect = clone.getBoundingClientRect();
      const width = Math.ceil(rect.width) || 842;
      const height = Math.ceil(rect.height) || 596;

      // Browsers cap canvas dimensions and, more sharply, the size of a data
      // URL a download can carry. A flat scale of 5 pushed a desktop-sized
      // certificate past both, which is why the download silently did nothing
      // on laptops while the smaller mobile layout squeaked through. Cap the
      // long edge instead so the output stays high-resolution but always
      // representable.
      const MAX_EDGE = 4000;
      const scale = Math.max(1, Math.min(4, MAX_EDGE / Math.max(width, height)));

      return await html2canvas(clone, {
        width,
        height,
        // Pins the origin html2canvas measures against, so the pinned clone
        // resolves to exactly (0, 0).
        scrollX: 0,
        scrollY: 0,
        logging: false,
        allowTaint: true,
        backgroundColor: 'white',
        useCORS: true,
        // Every template puts its titles, body, signatures and logos inside
        // SVG <foreignObject> elements. html2canvas's default renderer walks
        // the DOM and lays each node out itself, which ignores the
        // foreignObject's own x/y and drops all that text in the wrong place.
        // This flag hands the whole tree to the browser to render instead, so
        // the capture matches what is on screen. Note it requires every image
        // to already be a data URL — Content.jsx inlines the logos and
        // signatures for exactly this reason.
        foreignObjectRendering: true,
        scale,
        // A <style> already inside the subtree is dropped during cloning, so
        // the embedded faces have to be added afterwards, here.
        onclone: (_doc, clonedRoot) => {
          if (!fontCss) return;
          const styleEl = _doc.createElement('style');
          styleEl.textContent = fontCss;
          clonedRoot.appendChild(styleEl);
        },
      });
    } finally {
      document.body.removeChild(stage);
    }
  };

  // Object URLs sidestep the data-URL size limit that broke the desktop
  // download, and Firefox only fires a download for an anchor that is actually
  // in the document.
  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleDownloadImage = async () => {
    if (imageDownloading) return;
    try {
      if (imageDownloaded && !confirm('you want to download again')) {
        return;
      }
      setImageDownloading(true);
      const canvas = await renderCanvas();
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error('Could not encode the image.')),
          'image/png'
        )
      );
      saveBlob(blob, 'certificate-by-XCEED.png');
      setImageDownloaded(true);
    } catch (error) {
      console.error('Error downloading the image:', error);
      alert('An unexpected error occurred while downloading the image. Please try again later.');
    } finally {
      setImageDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (pdfDownloading) return;
    try {
      if (pdfDownloaded && !confirm('you want to download again')) {
        return;
      }
      setpdfDownloading(true);
      const canvas = await renderCanvas();
      // One page, exactly the shape of the certificate, so nothing is letterboxed.
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        0,
        canvas.width,
        canvas.height
      );
      saveBlob(pdf.output('blob'), 'certificate-by-XCEED.pdf');
      setpdfDownloaded(true);
    } catch (error) {
      console.error('Error downloading the PDF:', error);
      alert('An unexpected error occurred while downloading the PDF. Please try again later.');
    } finally {
      setpdfDownloading(false);
    }
  };

  return (
    <>
      <div id="id-card-class">
        <Content />
      </div>
      <div className="tw-hidden">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1122.52 793.7"
          ref={svgRef}
        >
          <Top />
          <Bottom />
        </svg>
      </div>
      <div className="tw-flex tw-items-center tw-gap-2">
        <Button
          isDisabled={imageDownloading || pdfDownloading}
          isLoading={imageDownloading}
          loadingText="Downloading"
          onClick={handleDownloadImage}
          variant="solid"
          colorScheme="teal"
        >
          Download Image
        </Button>
        <Button
          isDisabled={imageDownloading || pdfDownloading}
          isLoading={pdfDownloading}
          loadingText="Downloading"
          onClick={handleDownloadPDF}
          variant="outline"
          colorScheme="teal"
        >
          Download PDF
        </Button>
      </div>
    </>
  );
}

export default Template01;
