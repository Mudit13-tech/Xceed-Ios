//========================PREMIUM 08 — Regal Laurel======================

import React from 'react';
import { useEffect, useRef } from 'react';

import ReactHtmlParser from 'react-html-parser';
import QRCode from 'qrcode';
import { Text } from '@chakra-ui/react';

const IVORY = '#FBF7EE';
const MAROON = '#5B1A24';
const GOLD = '#B98C2F';
const GOLD_LIGHT = '#E3C77A';

// One half of the wreath. It is drawn twice rather than referenced with <use>,
// which html2canvas does not follow when the certificate is rasterised.
const LaurelHalf = ({ transform }) => (
  <g transform={transform}>
    <path
      d="M0 96C-34 62-46 22-40-22-8-4 8 26 6 62"
      fill="none"
      stroke={GOLD}
      strokeWidth="4"
    />
    <g fill={GOLD}>
      <ellipse cx="-30" cy="-8" rx="13" ry="6" transform="rotate(-28 -30 -8)" />
      <ellipse cx="-26" cy="18" rx="14" ry="6" transform="rotate(-20 -26 18)" />
      <ellipse cx="-18" cy="44" rx="14" ry="6" transform="rotate(-10 -18 44)" />
      <ellipse cx="-6" cy="68" rx="13" ry="6" transform="rotate(4 -6 68)" />
      <ellipse cx="-8" cy="6" rx="12" ry="5" transform="rotate(38 -8 6)" />
      <ellipse cx="-2" cy="32" rx="12" ry="5" transform="rotate(48 -2 32)" />
    </g>
  </g>
);

const CertificateContent = ({
  eventId,
  contentBody,
  certiType,
  title,
  certificateOf,
  verifiableLink,
  logos,
  participantDetail,
  signature,
  header,
  footer,
}) => {
  verifiableLink = verifiableLink == 'true';
  var num_logos = logos.length;
  var num_left = 0;
  if (num_logos % 2 === 0) {
    num_left = num_logos / 2 - 1;
  } else {
    num_left = Math.floor(num_logos / 2);
  }
  const svgRef = useRef();

  useEffect(() => {
    const url = window.location.href;
    const svg = svgRef.current;

    QRCode.toDataURL(url, (err, dataUrl) => {
      if (err) throw err;

      const image = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'image'
      );
      image.setAttribute('x', '110');
      image.setAttribute('y', '618');
      image.setAttribute('width', '86');
      image.setAttribute('height', '86');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
      image.classList.add('qrcode');
      svg.appendChild(image);
      if (!verifiableLink) {
        document.querySelectorAll('.qrcode').forEach((elem) => {
          elem.remove();
        });
      }
    });
  }, [verifiableLink]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: window.outerWidth >= 768 ? '841.9px' : window.outerWidth,
        height: window.outerWidth >= 768 ? '595.5px' : 'auto',
      }}
      viewBox="0 0 1122.52 793.7"
      id="svg"
      className="svg-img tw-object-contain"
      ref={svgRef}
    >
      <defs>
        <linearGradient id="p08-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GOLD_LIGHT} />
          <stop offset="0.5" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_LIGHT} />
        </linearGradient>
      </defs>

      <rect width="1122.52" height="793.7" fill={IVORY} />

      {/* Maroon border band, with a gold rule floating inside it. */}
      <rect
        x="18"
        y="18"
        width="1086.52"
        height="757.7"
        fill="none"
        stroke={MAROON}
        strokeWidth="26"
      />
      <rect
        x="18"
        y="18"
        width="1086.52"
        height="757.7"
        fill="none"
        stroke="url(#p08-gold)"
        strokeWidth="2"
      />
      <rect
        x="48"
        y="48"
        width="1026.52"
        height="697.7"
        fill="none"
        stroke="url(#p08-gold)"
        strokeWidth="3"
      />

      {/* Filigree arcs tucked into each corner of the inner rule. */}
      <g fill="none" stroke={GOLD} strokeWidth="2">
        <path d="M48 128c44 0 80-36 80-80" />
        <path d="M48 104c30 0 56-26 56-56" />
        <path d="M1074.52 128c-44 0-80-36-80-80" />
        <path d="M1074.52 104c-30 0-56-26-56-56" />
        <path d="M48 665.7c44 0 80 36 80 80" />
        <path d="M48 689.7c30 0 56 26 56 56" />
        <path d="M1074.52 665.7c-44 0-80 36-80 80" />
        <path d="M1074.52 689.7c-30 0-56 26-56 56" />
      </g>

      {/* Laurel wreath watermark behind the body text. */}
      <g transform="translate(561 470)" opacity="0.12">
        <LaurelHalf />
        <LaurelHalf transform="scale(-1 1)" />
      </g>

      {/* Ribbon banner sitting under the award line. */}
      <g transform="translate(561 386)">
        <path fill={MAROON} d="M-150-16h300v32h-300z" />
        <path fill={MAROON} d="M-198-24l48 24-48 24 16-24z" />
        <path fill={MAROON} d="M198-24l-48 24 48 24-16-24z" />
        <path
          fill="none"
          stroke={GOLD_LIGHT}
          strokeWidth="1.5"
          d="M-142-9h284v18h-284z"
        />
      </g>

      <foreignObject width={'90%'} height={'400'} y={'80'} x={'5%'}>
        <div
          style={{ height: '170px' }}
          className="tw-flex tw-items-center tw-justify-center tw-w-full"
        >
          {logos.map((item, key) => (
            <div
              key={key}
              className="tw-flex tw-items-center tw-justify-center "
            >
              <div
                style={{ width: `${item.width}px`, height: `${item.height}px` }}
                className="tw-w-20 tw-shrink-0 tw-mx-6"
              >
                <img
                  src={
                    item.url == '[object File]'
                      ? URL.createObjectURL(item.url)
                      : item.url
                  }
                  alt=""
                />
              </div>
              <div className="tw-text-center">
                {key === num_left && (
                  <>
                    {title.map((item, key) => (
                      <Text
                        fontSize={`${item.fontSize}px`}
                        fontFamily={item.fontFamily}
                        fontStyle={item.italic}
                        fontWeight={item.bold}
                        color={item.fontColor}
                        key={key}
                        className=" tw-text-center"
                      >
                        {item.name}
                      </Text>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </foreignObject>

      <foreignObject x="0%" y="215.473" width="100%" height="200">
        <div className="tw-mt-6 tw-text-center tw-flex-col tw-items-center tw-flex tw-gap-1 tw-justify-center">
          {header.map((item, ind) => (
            <Text
              width="70%"
              fontSize={`${item.fontSize}px`}
              fontFamily={item.fontFamily}
              fontStyle={item.italic}
              fontWeight={item.bold}
              color={item.fontColor}
              className="tw-uppercase tw-tracking-widest"
              key={ind}
            >
              {item.header}
            </Text>
          ))}
        </div>
      </foreignObject>

      {/* certificateOf */}
      <foreignObject y="300.473" width="100%" height="200">
        <Text
          width="100%"
          fontSize={`${certificateOf.fontSize}px`}
          fontFamily={certificateOf.fontFamily}
          fontStyle={certificateOf.italic}
          fontWeight={certificateOf.bold}
          color={certificateOf.fontColor}
          className="tw-text-center tw-uppercase opacity-80"
        >
          <div width="90%" className="tw-text-center tw-uppercase">
            {certificateOf.certificateOf}
          </div>
        </Text>
      </foreignObject>

      <foreignObject width="100%" x="11%" y="415.473" height="160">
        <Text
          width="77%"
          fontSize={`${contentBody.fontSize}px`}
          fontFamily={contentBody.fontFamily}
          fontStyle={contentBody.italic}
          fontWeight={contentBody.bold}
          color={contentBody.fontColor}
          className="tw-text-center opacity-80"
        >
          {ReactHtmlParser(contentBody.body)}
        </Text>
      </foreignObject>

      <foreignObject x={'20%'} y={455} width={'62%'} height={400}>
        <div
          style={{ height: '235px' }}
          className="tw-flex-wrap tw-flex tw-items-center tw-justify-between tw-gap-6 tw-px-6 "
        >
          {signature.map((item, key) => (
            <div
              key={key}
              style={{ height: '235px' }}
              className="tw-flex tw-flex-col tw-items-center tw-justify-end tw-gap-2"
            >
              <div
                style={{ width: `${item.url.size}px` }}
                className="tw-flex tw-flex-col tw-justify-end"
              >
                <img
                  src={
                    item.url.url == '[object File]'
                      ? URL.createObjectURL(item.url.url)
                      : item.url.url
                  }
                  alt=""
                />
              </div>
              <div className="tw-bg-gray-500 tw-rounded-xl tw-p-[1px] tw-w-[100px] tw-h-[1px]" />
              <Text
                fontSize={`${item.name.fontSize}px`}
                fontFamily={item.name.fontFamily}
                fontStyle={item.name.italic}
                fontWeight={item.name.bold}
                color={item.name.fontColor}
                className="tw-text-wrap tw-max-w-48 tw-text-center"
              >
                {item.name.name}
              </Text>
              <Text
                fontSize={`${item.position.fontSize}px`}
                fontFamily={item.position.fontFamily}
                fontStyle={item.position.italic}
                fontWeight={item.position.bold}
                color={item.position.fontColor}
                className="-tw-mt-3 tw-text-wrap tw-max-w-48 tw-text-center"
              >
                {item.position.position}
              </Text>
            </div>
          ))}
        </div>
      </foreignObject>

      {verifiableLink && (
        <foreignObject x={'0%'} y={'89%'} width={'100%'} height={'100'}>
          <div className="tw-text-sm tw-text-center tw-text-gray-700 ">
            {window.location.href}
          </div>
        </foreignObject>
      )}
      <foreignObject x={'0%'} y={'87%'} width={'100%'} height={'100'}>
        <Text className="tw-text-sm tw-text-center tw-text-gray-700 ">
          Issued On: {footer.footer}
        </Text>
      </foreignObject>
    </svg>
  );
};

export default CertificateContent;
