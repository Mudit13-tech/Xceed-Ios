import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import CertificateContent from './certificatetemplates/basic01';
import Template02 from './certificatetemplates/basic02';
import Template03 from './certificatetemplates/basic03';
import Template04 from './certificatetemplates/basic04';
import Template05 from './certificatetemplates/basic05';
import Template06 from './certificatetemplates/basic06';
import Template07 from './certificatetemplates/basic07';
import Template08 from './certificatetemplates/basic08';
import Template09 from './certificatetemplates/basic09';
import Template14 from './certificatetemplates/basic10';
import Template17 from './certificatetemplates/basic11';
import Template18 from './certificatetemplates/basic12';
import Template19 from './certificatetemplates/basic13';
import Template21 from './certificatetemplates/basic14';
import Template22 from './certificatetemplates/basic15';
import Template23 from './certificatetemplates/basic16';
import Template24 from './certificatetemplates/basic17';
import Template25 from './certificatetemplates/basic18';
import Template10 from './certificatetemplates/premium01';
import Template11 from './certificatetemplates/premium02';
import Template12 from './certificatetemplates/premium03';
import Template13 from './certificatetemplates/premium04';
import Template15 from './certificatetemplates/premium05';
import Template16 from './certificatetemplates/premium06';
import Template20 from './certificatetemplates/premium07';
import Template26 from './certificatetemplates/premium08';

// A logo counts as freely placed only once it has both coordinates. Logos saved
// before free placement existed have neither, so they keep flowing inside the
// template exactly as they always did.
export const isPlacedLogo = (logo) =>
  !!logo &&
  Number.isFinite(Number(logo.x)) &&
  Number.isFinite(Number(logo.y)) &&
  logo.x !== null &&
  logo.y !== null;

// Signatures follow the same rule as logos: no coordinates means the template
// keeps drawing the block wherever it always did.
export const isPlacedSignature = (item) =>
  !!item &&
  Number.isFinite(Number(item.x)) &&
  Number.isFinite(Number(item.y)) &&
  item.x !== null &&
  item.y !== null;

// The rule above the signer's name. It can be moved on its own, so it carries
// its own coordinates and width.
export const isPlacedLine = (line) =>
  !!line &&
  Number.isFinite(Number(line.x)) &&
  Number.isFinite(Number(line.y)) &&
  line.x !== null &&
  line.y !== null;

// The signer's name and their designation can each be pulled out of the
// signature block and placed on their own. Same rule again: no coordinates
// means the text still flows inside the block, directly under the rule.
export const isPlacedText = (text) =>
  !!text &&
  Number.isFinite(Number(text.x)) &&
  Number.isFinite(Number(text.y)) &&
  text.x !== null &&
  text.y !== null;

// The QR code follows the same rule: templates keep drawing it where they
// always did until someone moves it in the designer.
export const isPlacedQr = (qr) =>
  !!qr &&
  Number.isFinite(Number(qr.x)) &&
  Number.isFinite(Number(qr.y)) &&
  qr.x !== null &&
  qr.y !== null;

// Every template appends its own QR as an SVG image with this class. Hiding it
// with a scoped rule means a moved QR needs no change in the 20-odd templates.
const QR_HIDE_STYLE = `.cm-placed-qr .qrcode { display: none !important; }`;

function SelectCertficate({
  templateId,
  eventId,
  contentBody,
  certiType,
  certificateOf,
  title,
  verifiableLink,
  logos,
  participantDetail,
  signature,
  header,
  footer,
  overlay,
  qr,
}) {
  const showQr = verifiableLink === true || verifiableLink === 'true';
  const qrPlaced = showQr && isPlacedQr(qr);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!qrPlaced) return;
    // Same target the templates encode, so a moved QR scans identically.
    QRCode.toDataURL(window.location.href, (err, dataUrl) => {
      if (!err) setQrDataUrl(dataUrl);
    });
  }, [qrPlaced]);

  const allSignatures = Array.isArray(signature) ? signature : [];
  const placedSignatures = allSignatures
    .map((item, index) => ({ item, index }))
    .filter((entry) => isPlacedSignature(entry.item));
  // A placed signature is drawn entirely by the overlay, so it leaves the
  // template's own block behind — otherwise the separator rule the template
  // draws would be left hanging on its own.
  signature = allSignatures.filter((item) => !isPlacedSignature(item));

  const allLogos = Array.isArray(logos) ? logos : [];
  const placedLogos = allLogos.filter(isPlacedLogo);
  // A placed logo is drawn by the overlay instead of the template, but it keeps
  // its slot in the template's layout as an empty box of the same size. That
  // way the surrounding content (titles centred between logos, for instance)
  // stays exactly where it was.
  logos = allLogos.map((logo) =>
    isPlacedLogo(logo) ? { ...logo, url: '' } : logo
  );

  const certiDesignTemp = [
    <CertificateContent            //BASIC 01
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'0'}
    />,
    <Template02                   //BASIC 02
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'1'}
    />,
    <Template03                    //BASIC 03
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'2'}
    />,
    <Template04                    //BASIC 04
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      certificateOf={certificateOf}
      title={title}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'3'}
    />,
    <Template05                     //BASIC 05
      eventId={eventId}
      contentBody={contentBody}
      certificateOf={certificateOf}
      certiType={certiType}
      title={title}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'4'}
    />,
    <Template06                   //basic06
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'5'}
    />,
    <Template07                     //basic07
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'6'}
    />,
    <Template08                     //basic08
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      certificateOf={certificateOf}
      title={title}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'7'}
    />,

    <Template09                    //BASIC 09
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'8'}
    />,
    <Template10                   //PREMIUM 01
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'9'}
    />,
    <Template11                   //PREMIUM 02
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'10'}
    />,
    <Template12                   //PREMIUM 03
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'11'}
    />,
    <Template13                   //PREMIUM 04
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'12'}
    />,
    <Template14                   //BASIC 10
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'13'}
    />,
    <Template15                   //PREMIUM 05
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'14'}
    />,
    <Template16                   //PREMIUM 06
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'15'}
    />,
    
    <Template17                   //BASIC 11
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'16'}
      />,

      <Template18                   //BASIC 12
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'17'}
      />,
      <Template19                   //BASIC 13
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'18'}
      />,
      <Template20                   //PREMIUM 07
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'19'}
      />,
      <Template21                   //BASIC 14
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'20'}
      />,
      <Template22                   //BASIC 15
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'21'}
      />,
      <Template23                   //BASIC 16
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'22'}
      />,
      <Template24                   //BASIC 17
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'23'}
      />,
      <Template25                   //BASIC 18
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'24'}
      />,
      <Template26                   //PREMIUM 08
      eventId={eventId}
      contentBody={contentBody}
      certiType={certiType}
      title={title}
      certificateOf={certificateOf}
      verifiableLink={verifiableLink}
      logos={logos}
      participantDetail={participantDetail}
      signature={signature}
      header={header}
      footer={footer}
      key={'25'}
      />,
  ];

  return (
    <div
      className={qrPlaced ? 'cm-placed-qr' : undefined}
      style={{ position: 'relative', width: 'max-content' }}
    >
      {qrPlaced && <style>{QR_HIDE_STYLE}</style>}
      {certiDesignTemp[templateId]}

      {/* A moved QR is drawn here instead of inside the template. */}
      {qrPlaced && qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="Verification QR code"
          data-placed-qr="true"
          style={{
            position: 'absolute',
            left: `${Number(qr.x)}px`,
            top: `${Number(qr.y)}px`,
            width: `${Number(qr.size) || 100}px`,
            height: `${Number(qr.size) || 100}px`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Freely placed logos are drawn on top of the template, in the same
          coordinates the design page used to position them. */}
      {placedLogos.length > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          {placedLogos.map((logo, key) => (
            <img
              key={key}
              src={
                logo.url == '[object File]'
                  ? URL.createObjectURL(logo.url)
                  : logo.url
              }
              alt=""
              data-placed-logo="true"
              style={{
                position: 'absolute',
                left: `${Number(logo.x)}px`,
                top: `${Number(logo.y)}px`,
                width: `${logo.width || 80}px`,
                height: `${logo.height || 80}px`,
                objectFit: 'contain',
              }}
            />
          ))}
        </div>
      )}

      {/* Freely placed signatures: image, name and position, drawn with the
          same font settings the templates use. */}
      {placedSignatures.map(({ item, index }) => {
        const width = Number(item?.url?.size) || 100;
        const nameStyle = item.name || {};
        const positionStyle = item.position || {};
        return (
          <div
            key={`signature-${index}`}
            data-placed-signature="true"
            data-signature-index={index}
            style={{
              position: 'absolute',
              left: `${Number(item.x)}px`,
              top: `${Number(item.y)}px`,
              width: `${width}px`,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {item?.url?.url && (
              <img
                src={item.url.url}
                alt=""
                data-placed-signature="true"
                style={{ width: '100%', objectFit: 'contain' }}
              />
            )}

            {/* The rule the templates draw above the name. It stays inside the
                block until it is given coordinates of its own. */}
            {!isPlacedLine(item.line) && (
              <div
                data-signature-line="true"
                data-signature-index={index}
                style={{
                  width: `${Number(item?.line?.width) || 100}px`,
                  height: '1px',
                  background: '#6b7280',
                  borderRadius: '9999px',
                  margin: '6px auto',
                }}
              />
            )}

            {/* Name and designation stay here until they are given
                coordinates of their own, at which point they are drawn as
                free-standing blocks below. */}
            {!isPlacedText(nameStyle) && (
              <div
                data-signature-name="true"
                data-signature-index={index}
                style={{
                  fontSize: `${nameStyle.fontSize || 16}px`,
                  fontFamily: nameStyle.fontFamily || 'serif',
                  fontWeight: nameStyle.bold || 'normal',
                  fontStyle: nameStyle.italic || 'normal',
                  color: nameStyle.fontColor || 'black',
                  lineHeight: 1.2,
                }}
              >
                {nameStyle.name}
              </div>
            )}
            {!isPlacedText(positionStyle) && (
              <div
                data-signature-position="true"
                data-signature-index={index}
                style={{
                  fontSize: `${positionStyle.fontSize || 12}px`,
                  fontFamily: positionStyle.fontFamily || 'serif',
                  fontWeight: positionStyle.bold || 'normal',
                  fontStyle: positionStyle.italic || 'normal',
                  color: positionStyle.fontColor || 'black',
                  lineHeight: 1.2,
                }}
              >
                {positionStyle.position}
              </div>
            )}
          </div>
        );
      })}

      {/* Names and designations that were dragged away from their signature.
          They keep the same font settings they had inside the block. */}
      {placedSignatures.map(({ item, index }) => {
        const nameStyle = item.name || {};
        const positionStyle = item.position || {};
        return [
          isPlacedText(nameStyle) ? (
            <div
              key={`signature-name-${index}`}
              data-signature-name="true"
              data-signature-index={index}
              style={{
                position: 'absolute',
                left: `${Number(nameStyle.x)}px`,
                top: `${Number(nameStyle.y)}px`,
                fontSize: `${nameStyle.fontSize || 16}px`,
                fontFamily: nameStyle.fontFamily || 'serif',
                fontWeight: nameStyle.bold || 'normal',
                fontStyle: nameStyle.italic || 'normal',
                color: nameStyle.fontColor || 'black',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {nameStyle.name}
            </div>
          ) : null,
          isPlacedText(positionStyle) ? (
            <div
              key={`signature-position-${index}`}
              data-signature-position="true"
              data-signature-index={index}
              style={{
                position: 'absolute',
                left: `${Number(positionStyle.x)}px`,
                top: `${Number(positionStyle.y)}px`,
                fontSize: `${positionStyle.fontSize || 12}px`,
                fontFamily: positionStyle.fontFamily || 'serif',
                fontWeight: positionStyle.bold || 'normal',
                fontStyle: positionStyle.italic || 'normal',
                color: positionStyle.fontColor || 'black',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {positionStyle.position}
            </div>
          ) : null,
        ];
      })}

      {/* Separator rules that were dragged away from their signature. */}
      {placedSignatures.map(({ item, index }) =>
        isPlacedLine(item.line) ? (
          <div
            key={`signature-line-${index}`}
            data-signature-line="true"
            data-signature-index={index}
            style={{
              position: 'absolute',
              left: `${Number(item.line.x)}px`,
              top: `${Number(item.line.y)}px`,
              width: `${Number(item.line.width) || 100}px`,
              height: '1px',
              background: '#6b7280',
              borderRadius: '9999px',
              pointerEvents: 'none',
            }}
          />
        ) : null
      )}

      {overlay}
    </div>
  );
}

export default SelectCertficate;
