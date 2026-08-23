//========================BASIC 18 — Wave Crest======================

import React from 'react';
import { useEffect, useRef } from 'react';

import ReactHtmlParser from 'react-html-parser';
import QRCode from 'qrcode';
import { Text } from '@chakra-ui/react';

const TEAL_DEEP = '#0F766E';
const TEAL = '#14B8A6';
const INK = '#0B3B39';

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
      image.setAttribute('x', '92');
      image.setAttribute('y', '600');
      image.setAttribute('width', '90');
      image.setAttribute('height', '90');
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
        <clipPath id="b18-page">
          <rect width="1122.52" height="793.7" />
        </clipPath>
      </defs>

      <rect width="1122.52" height="793.7" fill="#FFFFFF" />

      <g clipPath="url(#b18-page)">
        {/* Two crests at the top, the paler one riding behind. */}
        <path
          fill={TEAL}
          opacity="0.35"
          d="M0 0h1122.52v96c-160 62-330 6-500 24S220 196 0 118Z"
        />
        <path
          fill={TEAL_DEEP}
          d="M0 0h1122.52v52c-190 78-368 8-548 26S186 152 0 74Z"
        />

        {/* Mirrored at the foot of the page. */}
        <path
          fill={TEAL}
          opacity="0.35"
          d="M1122.52 793.7H0v-96c160-62 330-6 500-24s402.52-76 622.52 2Z"
        />
        <path
          fill={TEAL_DEEP}
          d="M1122.52 793.7H0v-52c190-78 368-8 548-26s384.52-74 574.52 4Z"
        />
      </g>

      {/* A thin keyline holds the content away from the waves. */}
      <rect
        x="52"
        y="150"
        width="1018.52"
        height="500"
        fill="none"
        stroke={INK}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />

      {/* Short accent rule beneath the award line. */}
      <path d="M481 380h160" stroke={TEAL_DEEP} strokeWidth="3" />
      <circle cx="561" cy="380" r="6" fill={TEAL_DEEP} />

      <foreignObject width={'90%'} height={'400'} y={'165'} x={'5%'}>
        <div
          style={{ height: '160px' }}
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

      <foreignObject x="0%" y="235.473" width="100%" height="200">
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
      <foreignObject y="310.473" width="100%" height="200">
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

      <foreignObject width="100%" x="11%" y="400.473" height="160">
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

      <foreignObject x={'20%'} y={440} width={'62%'} height={400}>
        <div
          style={{ height: '230px' }}
          className="tw-flex-wrap tw-flex tw-items-center tw-justify-between tw-gap-6 tw-px-6 "
        >
          {signature.map((item, key) => (
            <div
              key={key}
              style={{ height: '230px' }}
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
        <foreignObject x={'0%'} y={'85%'} width={'100%'} height={'100'}>
          <div className="tw-text-sm tw-text-center tw-text-gray-700 ">
            {window.location.href}
          </div>
        </foreignObject>
      )}
      <foreignObject x={'0%'} y={'83%'} width={'100%'} height={'100'}>
        <Text className="tw-text-sm tw-text-center tw-text-gray-700 ">
          Issued On: {footer.footer}
        </Text>
      </foreignObject>
    </svg>
  );
};

export default CertificateContent;
