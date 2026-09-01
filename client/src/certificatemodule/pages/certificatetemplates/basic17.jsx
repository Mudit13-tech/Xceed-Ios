//========================BASIC 17 — Classic Bracket======================

import React from 'react';
import { useEffect, useRef } from 'react';

import ReactHtmlParser from 'react-html-parser';
import QRCode from 'qrcode';
import { Text } from '@chakra-ui/react';

const NAVY = '#1F3A5F';
const GOLD = '#C9A227';

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
      image.setAttribute('x', '95');
      image.setAttribute('y', '620');
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
      <rect width="1122.52" height="793.7" fill="#FFFFFF" />

      {/* Outer hairline and inner rule, the classic double frame. */}
      <rect
        x="28"
        y="28"
        width="1066.52"
        height="737.7"
        fill="none"
        stroke={NAVY}
        strokeWidth="1.5"
      />
      <rect
        x="42"
        y="42"
        width="1038.52"
        height="709.7"
        fill="none"
        stroke={NAVY}
        strokeWidth="4"
      />

      {/* Gold brackets sitting just inside the frame corners. */}
      <g fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="square">
        <path d="M60 122V60h62" />
        <path d="M1062.52 122V60h-62" />
        <path d="M60 671.7v62h62" />
        <path d="M1062.52 671.7v62h-62" />
      </g>
      <g fill={GOLD}>
        <circle cx="60" cy="60" r="6" />
        <circle cx="1062.52" cy="60" r="6" />
        <circle cx="60" cy="733.7" r="6" />
        <circle cx="1062.52" cy="733.7" r="6" />
      </g>

      {/* Rule under the award line, split by a small gold lozenge. */}
      <g stroke={GOLD} strokeWidth="2">
        <path d="M400 372h140" />
        <path d="M582 372h140" />
      </g>
      <path d="M561 362l7 10-7 10-7-10z" fill={GOLD} />

      {/* Rosette seal, bottom right. */}
      <g transform="translate(975 655)">
        <circle r="46" fill={NAVY} />
        <circle r="38" fill="none" stroke={GOLD} strokeWidth="2" />
        <path
          fill={GOLD}
          d="M0-26l6.6 15.9 17.2 1.4-13.1 11.2 4 16.8L0 9.6l-14.7 9.7 4-16.8-13.1-11.2 17.2-1.4z"
        />
        <path fill={NAVY} d="M-18 40h12l6 34-12-8-12 8z" />
        <path fill={NAVY} d="M18 40H6l-6 34 12-8 12 8z" />
      </g>

      <foreignObject width={'90%'} height={'400'} y={'70'} x={'5%'}>
        <div
          style={{ height: '180px' }}
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

      <foreignObject x="0%" y="205.473" width="100%" height="200">
        <div className="tw-mt-8 tw-text-center tw-flex-col tw-items-center tw-flex tw-gap-1 tw-justify-center">
          {header.map((item, ind) => (
            <Text
              width="70%"
              fontSize={`${item.fontSize}px`}
              fontFamily={item.fontFamily}
              fontStyle={item.italic}
              fontWeight={item.bold}
              color={item.fontColor}
              className="tw-uppercase"
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

      <foreignObject width="100%" x="11%" y="395.473" height="160">
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

      <foreignObject x={'20%'} y={445} width={'62%'} height={400}>
        <div
          style={{ height: '250px' }}
          className="tw-flex-wrap tw-flex tw-items-center tw-justify-between tw-gap-6 tw-px-6 "
        >
          {signature.map((item, key) => (
            <div
              key={key}
              style={{ height: '250px' }}
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
        <foreignObject x={'0%'} y={'92%'} width={'100%'} height={'100'}>
          <div className="tw-text-sm tw-text-center tw-text-gray-700 ">
            {window.location.href}
          </div>
        </foreignObject>
      )}
      <foreignObject x={'0%'} y={'90%'} width={'100%'} height={'100'}>
        <Text className="tw-text-sm tw-text-center tw-text-gray-700 ">
          Issued On: {footer.footer}
        </Text>
      </foreignObject>
    </svg>
  );
};

export default CertificateContent;
