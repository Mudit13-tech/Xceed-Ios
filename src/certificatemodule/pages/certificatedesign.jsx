import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Input,
  Button,
  VStack,
  IconButton,
  HStack,
  Flex,
  Box,
  Text,
  Container,
  Select,
  position,
  Checkbox,
  Image,
  Heading,
  Center,
  Tooltip,
  Switch,
} from '@chakra-ui/react';
import { AddIcon, ArrowBackIcon, CloseIcon, EditIcon, InfoIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import getEnvironment from '../../getenvironment';
// import Header from '../../components/header';
import { useToast } from '@chakra-ui/react';
import CertificateContent from './certificatetemplates/basic01';
import SelectCertficate, {
  isPlacedLine,
  isPlacedLogo,
  isPlacedQr,
  isPlacedSignature,
  isPlacedText,
} from './SelectCertficate';
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { HexAlphaColorPicker } from 'react-colorful';
import { FaUpload } from 'react-icons/fa';
import Signaturemodal from './signaturemodal';
import ImportCertificateDesign from './ImportCertificateDesign';

const CERTIFICATE_TYPES = ['participant', 'winner', 'speaker', 'organizer'];

// Placeholders the body text can interpolate. The "copy variable" panel and the
// highlighter below both read this list, so they can never drift apart.
const BODY_VARIABLES = [
  'name',
  'department',
  'college',
  'teamName',
  'position',
  'title1',
  'title2',
];

// A new certificate opens with every variable already wired into a sentence, so
// the shape of a body is obvious without hunting through the variables panel.
const DEFAULT_BODY_TEXT =
  'This is to certify that {{name}} of {{department}}, {{college}}, ' +
  'representing {{teamName}}, has secured {{position}} in {{title1}} ' +
  'organised as part of {{title2}}.';

const VARIABLE_PATTERN = /\{\{\s*\w+\s*\}\}/g;

// Layout shared by the chips and the plain text around them, so a line of body
// text measures the same in the editor as it does on the certificate.
const BODY_TEXT_METRICS = {
  fontSize: '16px',
  lineHeight: '1.8',
  letterSpacing: 'normal',
  padding: '8px 16px',
};

// A zero-width space parked after every chip: without it the browser has
// nowhere to put the caret when a chip ends a line.
const CARET_ANCHOR = '\u200b';

// Each variable lives in the body as one uneditable chip. The braces belong to
// the chip rather than to the text, so no amount of typing or backspacing
// inside the body can break a variable's syntax — a chip goes in or comes out
// whole.
function createVariableChip(name) {
  const chip = document.createElement('span');
  chip.setAttribute('contenteditable', 'false');
  chip.setAttribute('data-variable', name);
  chip.className = BODY_VARIABLES.includes(name)
    ? 'cert-var-chip'
    : 'cert-var-chip cert-var-chip--unknown';
  chip.textContent = name;
  return chip;
}

// Stored string -> chips and text.
function renderBodyInto(root, text) {
  root.textContent = '';

  const appendText = (plain) => {
    plain.split('\n').forEach((line, i) => {
      if (i > 0) root.appendChild(document.createElement('br'));
      if (line) root.appendChild(document.createTextNode(line));
    });
  };

  let cursor = 0;
  let match;
  VARIABLE_PATTERN.lastIndex = 0;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) appendText(text.slice(cursor, match.index));
    root.appendChild(createVariableChip(match[0].replace(/[{}\s]/g, '')));
    root.appendChild(document.createTextNode(CARET_ANCHOR));
    cursor = match.index + match[0].length;
  }
  appendText(text.slice(cursor));
}

// ...and back, so what gets saved is still the plain {{name}} string the
// certificate renderer already understands.
function serializeBody(root) {
  let out = '';

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue.split(CARET_ANCHOR).join('');
    } else if (node.nodeName === 'BR') {
      out += '\n';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const variable = node.getAttribute('data-variable');
      if (variable) {
        out += `{{${variable}}}`;
      } else {
        // A wrapper the browser added itself — Chrome starts a <div> per line.
        if (out && !out.endsWith('\n')) out += '\n';
        out += serializeBody(node);
      }
    }
  });

  return out;
}

// The body editor. A textarea can only hold characters, so variables are shown
// as chips in a contentEditable instead; `value`/`onChange` still speak the
// plain "{{name}}" string, and `apiRef` exposes insertVariable to the panel.
function BodyEditor({ value, onChange, apiRef, placeholder }) {
  const editorRef = useRef(null);
  const lastEmitted = useRef(null);
  const text = value || '';

  const emit = useCallback(() => {
    const next = serializeBody(editorRef.current);
    lastEmitted.current = next;
    onChange(next);
  }, [onChange]);

  // Rebuild only for changes that came from outside (a saved certificate
  // loading, the type switching). Rebuilding on our own keystrokes would throw
  // the caret back to the start of the box on every letter.
  useEffect(() => {
    if (!editorRef.current || text === lastEmitted.current) return;
    renderBodyInto(editorRef.current, text);
    lastEmitted.current = text;
  }, [text]);

  const insertVariable = useCallback(
    (name) => {
      const root = editorRef.current;
      if (!root) return;

      root.focus();
      const selection = window.getSelection();
      let range;
      if (
        selection &&
        selection.rangeCount > 0 &&
        root.contains(selection.getRangeAt(0).startContainer)
      ) {
        range = selection.getRangeAt(0);
      } else {
        // Never focused, or the caret is somewhere else on the page: append.
        range = document.createRange();
        range.selectNodeContents(root);
        range.collapse(false);
      }

      range.deleteContents();
      const anchor = document.createTextNode(CARET_ANCHOR);
      range.insertNode(anchor);
      range.insertNode(createVariableChip(name));

      const caret = document.createRange();
      caret.setStart(anchor, anchor.length);
      caret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caret);

      emit();
    },
    [emit]
  );

  useEffect(() => {
    if (!apiRef) return undefined;
    apiRef.current = { insertVariable };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, insertVariable]);

  return (
    <Box
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={emit}
      onBlur={emit}
      onPaste={(e) => {
        // Chips are ours to create; anything pasted in comes in as plain text.
        e.preventDefault();
        const pasted = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, pasted);
      }}
      width="100%"
      minH="120px"
      maxH="320px"
      overflowY="auto"
      resize="vertical"
      border="1px solid"
      borderColor="inherit"
      borderRadius="md"
      whiteSpace="pre-wrap"
      wordBreak="break-word"
      _focus={{
        outline: 'none',
        borderColor: 'blue.500',
        boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
      }}
      sx={{
        ...BODY_TEXT_METRICS,
        '&:empty::before': {
          content: 'attr(data-placeholder)',
          color: 'gray.400',
        },
        '.cert-var-chip': {
          display: 'inline-block',
          px: '6px',
          mx: '1px',
          borderRadius: '4px',
          bg: 'blue.50',
          color: 'blue.700',
          border: '1px solid',
          borderColor: 'blue.200',
          fontSize: '0.85em',
          lineHeight: '1.5',
          whiteSpace: 'nowrap',
          userSelect: 'all',
        },
        '.cert-var-chip--unknown': {
          bg: 'red.50',
          color: 'red.600',
          borderColor: 'red.200',
        },
      }}
    />
  );
}

// Winner is what most events design first, so it is the type this page opens on
// when nothing else is requested or already saved.
const DEFAULT_CERTI_TYPE = 'winner';

// Spellings and casings seen in saved certificates, mapped to the keys above.
const CERTI_TYPE_ALIASES = {
  organiser: 'organizer',
  organizor: 'organizer',
  participants: 'participant',
  winners: 'winner',
  speakers: 'speaker',
};

export const certiTypeStyle = (value) => {
  const key = String(value || '').trim().toLowerCase();
  return CERTI_TYPE_STYLES[key] || CERTI_TYPE_STYLES[CERTI_TYPE_ALIASES[key]] || null;
};

// Order shown in the dropdown — the default type sits at the top.
const CERTI_TYPE_ORDER = [
  DEFAULT_CERTI_TYPE,
  ...CERTIFICATE_TYPES.filter((type) => type !== DEFAULT_CERTI_TYPE),
];

// Each type gets its own colour so the one being edited is obvious at a glance.
// `panel` washes the whole form panel — light enough to read black text over,
// strong enough to notice — while `tint` is a shade up so badges and the type
// selector still stand out against it.
const CERTI_TYPE_STYLES = {
  winner: {
    label: 'Winner',
    scheme: 'pink',
    accent: 'pink.500',
    tint: 'pink.100',
    panel: 'pink.50',
  },
  participant: {
    label: 'Participant',
    scheme: 'blue',
    accent: 'blue.500',
    tint: 'blue.100',
    panel: 'blue.50',
  },
  speaker: {
    label: 'Speaker',
    scheme: 'purple',
    accent: 'purple.500',
    tint: 'purple.100',
    panel: 'purple.50',
  },
  organizer: {
    label: 'Organizer',
    scheme: 'green',
    accent: 'green.500',
    tint: 'green.100',
    panel: 'green.50',
  },
};

// How much of the width the form panel takes when the page first loads, and the
// range the splitter is allowed to move within.
const SPLIT_STORAGE_KEY = 'cm-certificate-design-split';
const DEFAULT_SPLIT = 42;
const MIN_SPLIT = 24;
const MAX_SPLIT = 76;
const MAX_PREVIEW_SCALE = 2.5;

const readStoredSplit = () => {
  try {
    const stored = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    if (!Number.isFinite(stored) || stored <= 0) return DEFAULT_SPLIT;
    return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, stored));
  } catch (error) {
    return DEFAULT_SPLIT;
  }
};

// The certificate templates render at a fixed A4-landscape size, so they would
// overflow a narrowed panel. This shrinks the whole certificate to whatever
// width the panel currently has instead of clipping it.
const ScaledCertificate = ({ children, onScaleChange }) => {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;

    const measure = () => {
      const available = outer.clientWidth;
      // offsetWidth/Height are the untransformed layout size, so scaling the
      // inner element never feeds back into this measurement.
      const naturalWidth = inner.offsetWidth;
      const naturalHeight = inner.offsetHeight;
      if (!available || !naturalWidth) return;

      // Fill the panel in both directions: shrink when it narrows, grow when
      // it widens (capped so a very wide panel doesn't blow the design up).
      const next = Math.min(MAX_PREVIEW_SCALE, available / naturalWidth);
      setScale(next);
      setNatural((current) =>
        current.width === naturalWidth && current.height === naturalHeight
          ? current
          : { width: naturalWidth, height: naturalHeight }
      );
      if (onScaleChange) onScaleChange(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [onScaleChange]);

  return (
    <Box ref={outerRef} width="100%" overflow="hidden">
      {/* The frame is exactly the scaled size, so the certificate stays centred
          and inside the panel however far the splitter is dragged. */}
      <Box
        mx="auto"
        overflow="hidden"
        style={{
          width: natural.width ? `${natural.width * scale}px` : '100%',
          height: natural.height ? `${natural.height * scale}px` : 'auto',
        }}
      >
        <Box
          ref={innerRef}
          width="max-content"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

// The dashboard links straight to one design with `?certiType=winner`. Anything
// unrecognised is ignored, leaving the old behaviour of resolving the first type
// that has a saved design.
const requestedCertiType = () => {
  const type = new URLSearchParams(window.location.search).get('certiType');
  return CERTIFICATE_TYPES.includes(type) ? type : '';
};

// Drag/resize handles drawn over the certificate preview. It lives inside the
// scaled certificate, so its own coordinates are template pixels; only pointer
// deltas need converting back from screen pixels.
const LogoPlacementLayer = ({
  logos,
  scale,
  onLogoChange,
  qr,
  showQr,
  onQrChange,
  signatures,
  onSignatureChange,
  onSignatureLineChange,
  onSignatureTextChange,
}) => {
  const layerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [measureTick, setMeasureTick] = useState(0);
  const [signatureHeights, setSignatureHeights] = useState({});
  // Name and designation have no stored width or height -- they are as big as
  // their text renders -- so the drag handles are sized from the DOM instead.
  const [textSizes, setTextSizes] = useState({});
  // Where the rule, the name and the designation are actually drawn while they
  // are still flowing inside their signature block. Handles sit on top of these
  // so the parts can be dragged without being pinned first.
  const [partRects, setPartRects] = useState({});
  const [hoveredKey, setHoveredKey] = useState(null);

  // Nothing on the certificate looks clickable on its own, so hovering shows a
  // dashed outline and selecting turns it solid — the same language for logos,
  // signatures, the separator rule and the QR.
  const outlineFor = (key, isSelected) => {
    if (isSelected) return `${2 / (scale || 1)}px solid #38A169`;
    if (hoveredKey === key) return `${2 / (scale || 1)}px dashed #38A169`;
    return `${2 / (scale || 1)}px solid transparent`;
  };

  const hoverProps = (key) => ({
    onPointerEnter: () => setHoveredKey(key),
    onPointerLeave: () => setHoveredKey((current) => (current === key ? null : current)),
  });

  // The drawn signature block sits right behind its handle; matching heights
  // keeps the outline around the whole thing, caption included.
  const registerSignatureNode = (index, node) => {
    const root = node?.parentElement?.parentElement;
    if (!root) return;
    const block = root.querySelector(
      `div[data-placed-signature="true"][data-signature-index="${index}"]`
    );
    if (!block) return;
    const height = Math.round(block.offsetHeight);
    if (!height) return;
    setSignatureHeights((current) =>
      current[index] === height ? current : { ...current, [index]: height }
    );
  };

  // Every logo is draggable from the moment it is drawn: any logo that has no
  // coordinates yet is measured where the template put it and pinned there, so
  // it stays visually identical while becoming movable.
  useEffect(() => {
    const layer = layerRef.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    if (!logos.some((logo) => logo && logo.url && !isPlacedLogo(logo))) return;

    const layerRect = layer.getBoundingClientRect();
    if (!layerRect.width) return;

    const bump = () => setMeasureTick((tick) => tick + 1);
    const templateImages = Array.from(root.querySelectorAll('img')).filter(
      (img) => img.dataset.placedLogo !== 'true'
    );
    const claimed = new Set();
    const safeScale = scale || 1;

    logos.forEach((logo, index) => {
      if (!logo || !logo.url || isPlacedLogo(logo)) return;

      let match = -1;
      for (let i = 0; i < templateImages.length; i += 1) {
        if (claimed.has(i)) continue;
        if (templateImages[i].getAttribute('src') === logo.url) {
          match = i;
          break;
        }
      }
      if (match === -1) return;
      claimed.add(match);

      const image = templateImages[match];
      if (!image.complete) {
        image.addEventListener('load', bump, { once: true });
        return;
      }

      const rect = image.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      onLogoChange(index, {
        x: Math.round((rect.left - layerRect.left) / safeScale),
        y: Math.round((rect.top - layerRect.top) / safeScale),
        width: Math.round(rect.width / safeScale),
        height: Math.round(rect.height / safeScale),
      });
    });
  }, [logos, scale, measureTick, onLogoChange]);

  // `key` is a logo index, or the string 'qr' for the QR code.
  const startGesture = (event, key, mode) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex(key);
    setSelectedIndex(key);

    const isQr = key === 'qr';
    const signatureIndex =
      typeof key === 'string' && key.startsWith('sig-')
        ? Number(key.slice(4))
        : -1;
    const lineIndex =
      typeof key === 'string' && key.startsWith('line-')
        ? Number(key.slice(5))
        : -1;
    // The signer's name and their designation each move on their own, so they
    // get their own keys and read their coordinates from their own sub-object.
    const nameIndex =
      typeof key === 'string' && key.startsWith('name-')
        ? Number(key.slice(5))
        : -1;
    const positionIndex =
      typeof key === 'string' && key.startsWith('pos-')
        ? Number(key.slice(4))
        : -1;
    const isSignature = signatureIndex >= 0;
    const isLine = lineIndex >= 0;
    const isName = nameIndex >= 0;
    const isPosition = positionIndex >= 0;
    const textField = isName ? 'name' : isPosition ? 'position' : null;
    const textIndex = isName ? nameIndex : positionIndex;
    const item = isQr
      ? qr || {}
      : isSignature
        ? signatures[signatureIndex] || {}
        : isLine
          ? signatures[lineIndex]?.line || {}
          : textField
            ? signatures[textIndex]?.[textField] || {}
            : logos[key];
    const startX = event.clientX;
    const startY = event.clientY;
    // A part still flowing inside its block has no coordinates yet, so the
    // drag starts from wherever it is currently drawn.
    const drawn = partRects[key];
    const origin = {
      x: Number(item.x) ?? null,
      y: Number(item.y) ?? null,
      width:
        Number(
          isQr
            ? item.size
            : isSignature
              ? item?.url?.size
              : isLine
                ? item.width
                : textField
                  ? textSizes[key]?.width
                  : item.width
        ) || (isQr ? 100 : isLine ? 100 : 80),
      height:
        Number(
          isQr
            ? item.size
            : isSignature
              ? signatureHeights[signatureIndex] || item?.url?.size
              : isLine
                ? 1
                : textField
                  ? textSizes[key]?.height
                  : item.height
        ) || (isQr ? 100 : isLine ? 1 : 80),
    };
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) {
      origin.x = drawn?.x || 0;
      origin.y = drawn?.y || 0;
    }

    const bounds = {
      width: layerRef.current?.clientWidth || 0,
      height: layerRef.current?.clientHeight || 0,
    };

    const apply = (patch) =>
      isQr
        ? onQrChange(patch)
        : isSignature
          ? onSignatureChange(signatureIndex, patch)
          : isLine
            ? onSignatureLineChange(lineIndex, patch)
            : textField
              ? onSignatureTextChange(textIndex, textField, patch)
              : onLogoChange(key, patch);

    const onMove = (moveEvent) => {
      const safeScale = scale || 1;
      const dx = (moveEvent.clientX - startX) / safeScale;
      const dy = (moveEvent.clientY - startY) / safeScale;

      if (mode === 'move') {
        const maxX = Math.max(0, bounds.width - origin.width);
        const maxY = Math.max(0, bounds.height - origin.height);
        apply({
          x: Math.round(Math.min(maxX, Math.max(0, origin.x + dx))),
          y: Math.round(Math.min(maxY, Math.max(0, origin.y + dy))),
        });
      } else if (isQr) {
        // The QR must stay square to keep scanning reliably.
        apply({ size: Math.round(Math.max(40, origin.width + dx)) });
      } else if (isSignature) {
        // Signature blocks scale by their image width; the caption follows.
        apply({ size: Math.round(Math.max(40, origin.width + dx)) });
      } else if (isLine) {
        // The rule only has a length worth changing.
        apply({ width: Math.round(Math.max(20, origin.width + dx)) });
      } else if (textField) {
        // Text is only ever moved -- its size is the font size, set in the
        // form, so there is no resize gesture to handle here.
      } else {
        apply({
          width: Math.round(Math.max(20, origin.width + dx)),
          height: Math.round(Math.max(20, origin.height + dy)),
        });
      }
    };

    const onUp = () => {
      setActiveIndex(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Signature blocks are measured from their image, the same way logos are.
  useEffect(() => {
    const layer = layerRef.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    if (
      !signatures.some(
        (item) => item?.url?.url && !isPlacedSignature(item)
      )
    )
      return;

    const layerRect = layer.getBoundingClientRect();
    if (!layerRect.width) return;

    const bump = () => setMeasureTick((tick) => tick + 1);
    const images = Array.from(root.querySelectorAll('img')).filter(
      (img) =>
        img.dataset.placedLogo !== 'true' &&
        img.dataset.placedSignature !== 'true'
    );
    const claimed = new Set();
    const safeScale = scale || 1;

    signatures.forEach((item, index) => {
      const url = item?.url?.url;
      if (!url || isPlacedSignature(item)) return;

      let match = -1;
      for (let i = 0; i < images.length; i += 1) {
        if (claimed.has(i)) continue;
        if (images[i].getAttribute('src') === url) {
          match = i;
          break;
        }
      }
      if (match === -1) return;
      claimed.add(match);

      const image = images[match];
      if (!image.complete) {
        image.addEventListener('load', bump, { once: true });
        return;
      }

      const rect = image.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      onSignatureChange(index, {
        x: Math.round((rect.left - layerRect.left) / safeScale),
        y: Math.round((rect.top - layerRect.top) / safeScale),
      });
    });
  }, [signatures, scale, measureTick, onSignatureChange]);

  // The rule, the name and the designation stay where the block puts them —
  // the rule above the name, the designation under it, exactly as the templates
  // draw them. They are only measured here, so a handle can be placed over each
  // one; dragging is what gives a part coordinates of its own.
  useEffect(() => {
    const layer = layerRef.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;

    const layerRect = layer.getBoundingClientRect();
    if (!layerRect.width) return;
    const safeScale = scale || 1;

    const sizes = {};
    const rects = {};

    const record = (key, node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      sizes[key] = {
        width: Math.round(rect.width / safeScale),
        height: Math.round(rect.height / safeScale),
      };
      rects[key] = {
        ...sizes[key],
        x: Math.round((rect.left - layerRect.left) / safeScale),
        y: Math.round((rect.top - layerRect.top) / safeScale),
      };
    };

    signatures.forEach((item, index) => {
      if (!isPlacedSignature(item)) return;

      [
        ['data-signature-line', `line-${index}`],
        ['data-signature-name', `name-${index}`],
        ['data-signature-position', `pos-${index}`],
      ].forEach(([attribute, key]) => {
        const node = root.querySelector(
          `div[${attribute}="true"][data-signature-index="${index}"]`
        );
        if (node) record(key, node);
      });
    });

    const same = (a, b) => {
      const keys = Object.keys(b);
      return (
        keys.length === Object.keys(a).length &&
        keys.every((key) =>
          Object.keys(b[key]).every((prop) => a[key]?.[prop] === b[key][prop])
        )
      );
    };

    setTextSizes((current) => (same(current, sizes) ? current : sizes));
    setPartRects((current) => (same(current, rects) ? current : rects));
  }, [signatures, scale, measureTick]);

  // Same idea for the QR code: the templates append it as an SVG image with the
  // class `qrcode`, so it is measured there and pinned in place.
  useEffect(() => {
    const layer = layerRef.current;
    const root = layer?.parentElement;
    if (!layer || !root) return undefined;
    if (!showQr || isPlacedQr(qr)) return undefined;

    const layerRect = layer.getBoundingClientRect();
    if (!layerRect.width) return undefined;

    const node = root.querySelector('.qrcode');
    if (!node) {
      // The templates add it asynchronously once the QR image is encoded.
      const timer = window.setTimeout(() => setMeasureTick((t) => t + 1), 200);
      return () => window.clearTimeout(timer);
    }

    const rect = node.getBoundingClientRect();
    if (rect.width < 2) return undefined;

    const safeScale = scale || 1;
    onQrChange({
      x: Math.round((rect.left - layerRect.left) / safeScale),
      y: Math.round((rect.top - layerRect.top) / safeScale),
      size: Math.round(rect.width / safeScale),
    });
    return undefined;
  }, [qr, showQr, scale, measureTick, onQrChange]);

  useEffect(() => {
    if (selectedIndex === null) return undefined;
    const onPointerDown = (event) => {
      if (layerRef.current && layerRef.current.contains(event.target)) return;
      setSelectedIndex(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [selectedIndex]);

  // Handles keep a constant on-screen size however far the preview is scaled.
  const handleSize = 12 / (scale || 1);
  const borderWidth = 2 / (scale || 1);

  return (
    <div
      ref={layerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {logos.map((logo, index) => {
        if (!isPlacedLogo(logo)) return null;
        const isActive = activeIndex === index;
        const isSelected = selectedIndex === index || isActive;

        return (
          <div
            key={index}
            onPointerDown={(event) => startGesture(event, index, 'move')}
            {...hoverProps(index)}
            style={{
              position: 'absolute',
              left: `${Number(logo.x)}px`,
              top: `${Number(logo.y)}px`,
              width: `${logo.width || 80}px`,
              height: `${logo.height || 80}px`,
              // Dashed on hover, solid once selected.
              border: outlineFor(index, isSelected),
              background: isSelected ? 'rgba(56,161,105,0.08)' : 'transparent',
              cursor: 'move',
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
            title="Click to select · drag to move · drag the corner to resize"
          >
            {isSelected && (
              <div
                onPointerDown={(event) => startGesture(event, index, 'resize')}
                style={{
                  position: 'absolute',
                  right: `${-handleSize / 2}px`,
                  bottom: `${-handleSize / 2}px`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  borderRadius: '2px',
                  background: '#38A169',
                  cursor: 'nwse-resize',
                  pointerEvents: 'auto',
                  touchAction: 'none',
                }}
              />
            )}
          </div>
        );
      })}

      {signatures.map((item, index) => {
        if (!isPlacedSignature(item)) return null;
        const key = `sig-${index}`;
        const isSelected = selectedIndex === key || activeIndex === key;
        const width = Number(item?.url?.size) || 100;
        const height = signatureHeights[index] || width;

        return (
          <div
            key={key}
            ref={(node) => registerSignatureNode(index, node)}
            onPointerDown={(event) => startGesture(event, key, 'move')}
            {...hoverProps(key)}
            style={{
              position: 'absolute',
              left: `${Number(item.x)}px`,
              top: `${Number(item.y)}px`,
              width: `${width}px`,
              height: `${height}px`,
              border: outlineFor(key, isSelected),
              background: isSelected ? 'rgba(56,161,105,0.08)' : 'transparent',
              cursor: 'move',
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
            title="Signature — click to select, drag to move, drag the corner to resize"
          >
            {isSelected && (
              <div
                onPointerDown={(event) => startGesture(event, key, 'resize')}
                style={{
                  position: 'absolute',
                  right: `${-handleSize / 2}px`,
                  bottom: `${-handleSize / 2}px`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  borderRadius: '2px',
                  background: '#38A169',
                  cursor: 'nwse-resize',
                  pointerEvents: 'auto',
                  touchAction: 'none',
                }}
              />
            )}
          </div>
        );
      })}

      {/* One handle per text, so the name and the designation move apart. */}
      {signatures.flatMap((item, index) => {
        if (!isPlacedSignature(item)) return [];
        return [
          ['name', `name-${index}`, item?.name, "Signer's name"],
          ['position', `pos-${index}`, item?.position, 'Designation'],
        ].map(([field, key, text, label]) => {
          const drawn = partRects[key];
          const size = textSizes[key];
          if (!size) return null;
          const placed = isPlacedText(text);
          if (!placed && !drawn) return null;
          const left = placed ? Number(text.x) : drawn.x;
          const top = placed ? Number(text.y) : drawn.y;
          const isSelected = selectedIndex === key || activeIndex === key;

          return (
            <div
              key={key}
              onPointerDown={(event) => startGesture(event, key, 'move')}
              {...hoverProps(key)}
              style={{
                position: 'absolute',
                left: `${left}px`,
                top: `${top}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                border: outlineFor(key, isSelected),
                background: isSelected
                  ? 'rgba(56,161,105,0.12)'
                  : 'transparent',
                cursor: 'move',
                pointerEvents: 'auto',
                touchAction: 'none',
              }}
              title={`${label} — drag to move it on its own`}
            />
          );
        });
      })}

      {signatures.map((item, index) => {
        if (!isPlacedSignature(item)) return null;
        const key = `line-${index}`;
        const drawn = partRects[key];
        const placed = isPlacedLine(item?.line);
        if (!placed && !drawn) return null;
        const isSelected = selectedIndex === key || activeIndex === key;
        const width = Number(item?.line?.width) || drawn?.width || 100;
        const left = placed ? Number(item.line.x) : drawn.x;
        const top = placed ? Number(item.line.y) : drawn.y;
        // A one-pixel rule is impossible to grab, so the handle is padded.
        const grab = 10 / (scale || 1);

        return (
          <div
            key={key}
            onPointerDown={(event) => startGesture(event, key, 'move')}
            {...hoverProps(key)}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top - grab / 2}px`,
              width: `${width}px`,
              height: `${grab}px`,
              border: outlineFor(key, isSelected),
              background: isSelected ? 'rgba(56,161,105,0.12)' : 'transparent',
              cursor: 'move',
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
            title="Separator line — click to select, drag to move, drag the end to change its length"
          >
            {isSelected && (
              <div
                onPointerDown={(event) => startGesture(event, key, 'resize')}
                style={{
                  position: 'absolute',
                  right: `${-handleSize / 2}px`,
                  top: `${(grab - handleSize) / 2}px`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  borderRadius: '2px',
                  background: '#38A169',
                  cursor: 'ew-resize',
                  pointerEvents: 'auto',
                  touchAction: 'none',
                }}
              />
            )}
          </div>
        );
      })}

      {showQr && isPlacedQr(qr) && (
        <div
          onPointerDown={(event) => startGesture(event, 'qr', 'move')}
          {...hoverProps('qr')}
          style={{
            position: 'absolute',
            left: `${Number(qr.x)}px`,
            top: `${Number(qr.y)}px`,
            width: `${Number(qr.size) || 100}px`,
            height: `${Number(qr.size) || 100}px`,
            border: outlineFor('qr', selectedIndex === 'qr'),
            background:
              selectedIndex === 'qr' ? 'rgba(56,161,105,0.08)' : 'transparent',
            cursor: 'move',
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
          title="QR code — click to select, drag to move, drag the corner to resize"
        >
          {selectedIndex === 'qr' && (
            <div
              onPointerDown={(event) => startGesture(event, 'qr', 'resize')}
              style={{
                position: 'absolute',
                right: `${-handleSize / 2}px`,
                bottom: `${-handleSize / 2}px`,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
                borderRadius: '2px',
                background: '#38A169',
                cursor: 'nwse-resize',
                pointerEvents: 'auto',
                touchAction: 'none',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

const CertificateForm = () => {
  const apiUrl = getEnvironment();
  const navigate = useNavigate();
  const toast = useToast();

  // Lets the variables panel drop a chip in at the body editor's caret.
  const bodyEditorRef = useRef(null);

  // Resizable split between the form panel and the certificate preview.
  const shellRef = useRef(null);
  const [splitPct, setSplitPct] = useState(readStoredSplit);
  const [isDragging, setIsDragging] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isDragging) return undefined;

    const onMove = (event) => {
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      if (!rect.width) return;
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, pct));
      setSplitPct(clamped);
    };

    const onUp = () => {
      setIsDragging(false);
      setSplitPct((current) => {
        try {
          window.localStorage.setItem(SPLIT_STORAGE_KEY, String(current));
        } catch (error) {
          /* storage unavailable — the layout just won't be remembered */
        }
        return current;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging]);

  const handlePreviewScale = useCallback((value) => setPreviewScale(value), []);


  const [isCertificateLoading, setIsCertificateLoading] = useState(false);
  const [isResolvingInitialType, setIsResolvingInitialType] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  // The design last loaded or saved on this page. Switching to a type that has
  // no design of its own opens on a copy of it, so the four types can be built
  // from one — but only in the form: it is written to the server only if the
  // user saves it under the new type.
  const carryOverRef = useRef(null);
  const date = new Date();
  const a = date.getMonth() > 8 ? '' : 0;
  const defaultDate = `${date.getFullYear()}-${a}${
    date.getMonth() + 1
  }-${date.getDate()}`;
  const [formData, setFormData] = useState({
    logos: [{ url: '', height: 80, width: 80 }],
    header: [
      {
        header: '',
        fontSize: 22,
        fontFamily: '',
        bold: 'bold',
        italic: 'normal',
        fontColor: 'black',
      },
    ],
    body: {
      body: DEFAULT_BODY_TEXT,
      fontSize: 16,
      fontFamily: '',
      bold: 'normal',
      italic: 'normal',
      fontColor: 'black',
    },
    footer: { footer: defaultDate },
    signatures: [
      {
        name: {
          name: '',
          fontSize: 14,
          fontFamily: '',
          bold: 'normal',
          italic: 'normal',
          fontColor: 'black',
        },
        position: {
          position: '',
          fontSize: 12,
          fontFamily: '',
          bold: 'normal',
          italic: 'normal',
          fontColor: 'black',
        },
        url: { url: '', size: 100 },
      },
    ],
    certiType: requestedCertiType(),
    templateId: '0', //Template Design Number
    title: [
      {
        name: 'डॉ बी आर अम्बेडकर राष्ट्रीय प्रौद्योगिकी संस्थान जालंधर',
        fontSize: 20,
        fontFamily: 'Noto Serif Devanagari',
        bold: 'bold',
        italic: 'normal',
        fontColor: 'black',
      },
      {
        name: 'जी.टी. रोड, अमृतसर बाईपास, जालंधर, पंजाब, भारत-144008',
        fontSize: 16,
        fontFamily: 'Noto Serif Devanagari',
        bold: 'normal',
        italic: 'normal',
        fontColor: 'black',
      },
      {
        name: 'Dr B R Ambedkar National Institute of Technology Jalandhar',
        fontSize: 20,
        fontFamily: 'serif',
        bold: 'bold',
        italic: 'normal',
        fontColor: 'black',
      },
      {
        name: 'G.T Road, Amritsar Bypass, Jalandhar, Punjab, India-144008',
        fontSize: 16,
        fontFamily: 'serif',
        bold: 'normal',
        italic: 'normal',
        fontColor: 'black',
      },
    ],
    verifiableLink: true,
    // Null coordinates mean "wherever the template puts it".
    qr: { x: null, y: null, size: 100 },
    certificateOf: {
      certificateOf: 'CERTIFICATE OF APPRECIATION',
      fontSize: 32,
      fontFamily: '',
      bold: 'bold',
      italic: 'normal',
      fontColor: 'black',
    },
  });

  // console.log(formData.templateId);

  const currentURL = window.location.pathname;
  const parts = currentURL.split('/');
  const eventId = parts[parts.length - 1];
  const certificateTypes = CERTIFICATE_TYPES;

  const getDefaultSignature = () => ({
    name: {
      name: '',
      fontSize: 12,
      fontFamily: '',
      bold: 'normal',
      italic: 'normal',
      fontColor: 'black',
    },
    position: {
      position: '',
      fontSize: 10,
      fontFamily: '',
      bold: 'normal',
      italic: 'normal',
      fontColor: 'black',
    },
    url: { url: '', size: 100 },
  });

  const normalizeSignature = (signature) => {
    // Coordinates are absent on signatures saved before free placement.
    const placement = {
      x: signature?.x ?? null,
      y: signature?.y ?? null,
      line: {
        x: signature?.line?.x ?? null,
        y: signature?.line?.y ?? null,
        width: signature?.line?.width ?? 100,
      },
    };
    const fallback = getDefaultSignature();
    if (!signature || typeof signature !== 'object') {
      return fallback;
    }

    const normalizedName =
      signature.name && typeof signature.name === 'object'
        ? {
            ...fallback.name,
            ...signature.name,
            name: signature.name.name ?? fallback.name.name,
          }
        : {
            ...fallback.name,
            name: signature.name ?? fallback.name.name,
          };

    const normalizedPosition =
      signature.position && typeof signature.position === 'object'
        ? {
            ...fallback.position,
            ...signature.position,
            position: signature.position.position ?? fallback.position.position,
          }
        : {
            ...fallback.position,
            position: signature.position ?? fallback.position.position,
          };

    const normalizedUrl =
      signature.url && typeof signature.url === 'object'
        ? {
            ...fallback.url,
            ...signature.url,
            url: signature.url.url ?? fallback.url.url,
          }
        : {
            ...fallback.url,
            url: signature.url ?? fallback.url.url,
          };

    return {
      name: normalizedName,
      position: normalizedPosition,
      url: normalizedUrl,
      ...placement,
    };
  };

  useEffect(() => {
    const resolveInitialType = async () => {
      if (formData.certiType) {
        setIsResolvingInitialType(false);
        return;
      }

      // Try the default type first, then the rest, so an event with no saved
      // design at all still lands on Winner.
      const orderedTypes = [
        DEFAULT_CERTI_TYPE,
        ...certificateTypes.filter((type) => type !== DEFAULT_CERTI_TYPE),
      ];
      let resolved = '';

      try {
        for (const certType of orderedTypes) {
          const response = await fetch(
            `${apiUrl}/certificatemodule/certificate/getcertificatedetails/${eventId}/${certType}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            }
          );

          if (!response.ok) {
            continue;
          }

          const responseData = await response.json();
          if (
            responseData &&
            Array.isArray(responseData) &&
            responseData.length > 0
          ) {
            resolved = certType;
            break;
          }
        }
      } catch (error) {
        console.error('Error resolving certificate type:', error);
      } finally {
        setFormData((prev) => ({
          ...prev,
          certiType: resolved || DEFAULT_CERTI_TYPE,
        }));
        setIsResolvingInitialType(false);
      }
    };

    resolveInitialType();
  }, [apiUrl, eventId, formData.certiType]);

  // Designs are plain JSON, so this is enough to hand a copy to another type
  // without the two sharing (and mutating) the same nested objects.
  const cloneDesign = (design) => JSON.parse(JSON.stringify(design));

  // The empty form a type opens on when there is nothing to copy from.
  const blankFormData = (certType) => ({
    logos: [{ url: '', height: 80, width: 80 }],
    header: [
      {
        header: '',
        fontSize: 22,
        fontFamily: '',
        bold: 'bold',
        italic: 'normal',
        fontColor: 'black',
      },
    ],
    body: {
      body: DEFAULT_BODY_TEXT,
      fontSize: 16,
      fontFamily: '',
      bold: 'normal',
      italic: 'normal',
      fontColor: 'black',
    },
    footer: { footer: defaultDate },
    signatures: [getDefaultSignature()],
    certiType: certType,
    templateId: '0', //Template Design Number
    title: [
      {
        name: 'डॉ बी आर अम्बेडकर राष्ट्रीय प्रौद्योगिकी संस्थान जालंधर',
        fontSize: 20,
        fontFamily: 'Noto Serif Devanagari',
        bold: 'bold',
        italic: 'normal',
        fontColor: 'black',
      },
      {
        name: 'जी.टी. रोड, अमृतसर बाईपास, जालंधर, पंजाब, भारत-144008',
        fontSize: 14,
        fontFamily: 'Noto Serif Devanagari',
        bold: 'normal',
        italic: 'normal',
        fontColor: 'black',
      },
      {
        name: 'Dr B R Ambedkar National Institute of Technology Jalandhar',
        fontSize: 19,
        fontFamily: 'serif',
        bold: 'bold',
        italic: 'normal',
        fontColor: 'black',
      },
      {
        name: 'G.T Road, Amritsar Bypass, Jalandhar, Punjab, India-144008',
        fontSize: 14,
        fontFamily: 'serif',
        bold: 'normal',
        italic: 'normal',
        fontColor: 'black',
      },
    ],
    verifiableLink: true,
    // Null coordinates mean "wherever the template puts it".
    qr: { x: null, y: null, size: 100 },
    certificateOf: {
      certificateOf: 'CERTIFICATE OF APPRECIATION',
      fontSize: 32,
      fontFamily: '',
      bold: 'bold',
      italic: 'normal',
      fontColor: 'black',
    },
  });

  // Turns a saved certificate document into the shape the form edits. Older
  // documents are missing fields or store them in long-gone shapes, so most
  // branches here are migrations of one of those.
  const buildFormDataFromDoc = (doc, certType) => {
    let {
      certificateOf,
      title,
      signatures,
      header,
      footer,
      body,
      logos,
      templateId,
      verifiableLink,
      qr,
    } = doc;

    const Signatures =
      Array.isArray(signatures) && signatures.length > 0
        ? signatures.map((signatureItem) => normalizeSignature(signatureItem))
        : [getDefaultSignature()];
    const defaultHeader = {
      header: '',
      fontSize: 22,
      fontFamily: '',
      bold: 'bold',
      italic: 'normal',
      fontColor: 'black',
    };
    const defaultBody = {
      body: DEFAULT_BODY_TEXT,
      fontSize: 16,
      fontFamily: '',
      bold: 'normal',
      italic: 'normal',
      fontColor: 'black',
    };
    const defaultCertificateOf = {
      certificateOf: 'CERTIFICATE OF APPRECIATION',
      fontSize: 32,
      fontFamily: '',
      bold: 'bold',
      italic: 'normal',
      fontColor: 'black',
    };

    //for logos
    const Logos =
      Array.isArray(logos) && logos.length > 0
        ? logos.map((logoItem) => {
            if (logoItem && typeof logoItem === 'object') {
              if (logoItem.url || logoItem.url === '') {
                return {
                  url: logoItem.url,
                  height: logoItem.height ?? 80,
                  width: logoItem.width ?? 80,
                  // Absent on every certificate saved before free
                  // placement, which keeps them in template layout.
                  x: logoItem.x ?? null,
                  y: logoItem.y ?? null,
                };
              }

              let str = '';
              for (let key in logoItem) {
                parseInt(key) || key == '0' ? (str = str + logoItem[key]) : '';
              }
              return { url: str, width: 80, height: 80 };
            }

            return { url: logoItem || '', width: 80, height: 80 };
          })
        : [{ url: '', height: 80, width: 80 }];

    //for header (department/club)
    const Header =
      Array.isArray(header) && header.length > 0
        ? header.map((headerItem) => {
            if (headerItem && typeof headerItem === 'object') {
              if (headerItem.header || headerItem.header === '') {
                return {
                  ...defaultHeader,
                  ...headerItem,
                };
              }

              let str = '';
              for (let key in headerItem) {
                parseInt(key) || key == '0' ? (str = str + headerItem[key]) : '';
              }
              return {
                ...defaultHeader,
                header: str,
              };
            }

            return {
              ...defaultHeader,
              header: headerItem || '',
            };
          })
        : [defaultHeader];

    // for footer
    const Footer =
      footer && typeof footer === 'object' && !Array.isArray(footer)
        ? { footer: footer.footer ?? defaultDate }
        : { footer: defaultDate };

    //for certificateOf
    const CertificateOf =
      certificateOf &&
      typeof certificateOf === 'object' &&
      !Array.isArray(certificateOf)
        ? {
            ...defaultCertificateOf,
            ...certificateOf,
            certificateOf:
              certificateOf.certificateOf ?? defaultCertificateOf.certificateOf,
          }
        : defaultCertificateOf;

    // for body
    const Body =
      body && typeof body === 'object' && !Array.isArray(body)
        ? {
            ...defaultBody,
            ...body,
            // A saved-but-empty body still opens on the default
            // sentence, so the chips are always there to start from.
            body: body.body || defaultBody.body,
          }
        : {
            ...defaultBody,
            body: body || defaultBody.body,
          };

    //for title
    let Title = [];
    if (Array.isArray(title) && title.length > 0) {
      if (title[0] && (title[0][0] || title[0][0] == '')) {
        title.forEach((element) => {
          let str = '';
          for (let key in element) {
            parseInt(key) || key == '0' ? (str = str + element[key]) : '';
          }
          let obj = {
            name: str,
            fontSize: '',
            fontFamily: '',
            bold: 'normal',
            italic: 'normal',
            fontColor: 'black',
          };
          Title.push(obj);
        });
      } else if (title[0]['name'] || title[0]['name'] == '') {
        Title = title;
      }
    }
    if (Title.length === 0) {
      Title = blankFormData(certType).title;
    }

    //for verifiableLink
    if (typeof verifiableLink === 'string') {
      verifiableLink = verifiableLink === 'true';
    } else {
      verifiableLink = !!verifiableLink;
    }

    return {
      title: Title,
      body: Body,
      certificateOf: CertificateOf,
      footer: Footer,
      header: Header,
      signatures: Signatures,
      // Always the type being edited rather than the one the document was saved
      // under, since the same document is reused when a design is copied over.
      certiType: certType,
      logos: Logos,
      templateId: templateId ?? '0',
      verifiableLink: verifiableLink,
      // Absent on certificates saved before the QR could be moved.
      qr: {
        x: qr?.x ?? null,
        y: qr?.y ?? null,
        size: qr?.size ?? 100,
      },
    };
  };

  // Reads one type's saved design, or null when that type has none yet — which
  // the API reports as a 400, so it is not an error worth surfacing here.
  const fetchCertificateDoc = async (certType) => {
    try {
      const response = await fetch(
        `${apiUrl}/certificatemodule/certificate/getcertificatedetails/${eventId}/${certType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );
      if (!response.ok) return null;
      const responseData = await response.json();
      return Array.isArray(responseData) && responseData.length > 0
        ? responseData[0]
        : null;
    } catch (error) {
      console.error('Error fetching form data:', error);
      return null;
    }
  };

  {
    /* Purpose: Loads the selected type's saved design. A type that has none yet
       opens on a copy of the design last loaded or saved, so the four types can
       be built from one. The copy only fills the form — nothing reaches the
       server until the user saves it. */
  }
  useEffect(() => {
    const certType = formData.certiType;
    if (!certType) return undefined;

    let cancelled = false;
    setSelectedFiles([]);

    const loadDesign = async () => {
      setIsCertificateLoading(true);
      const doc = await fetchCertificateDoc(certType);
      if (cancelled) return;

      if (doc) {
        const loaded = buildFormDataFromDoc(doc, certType);
        setFormData(loaded);
        // Whatever design was last opened is what an undesigned type copies.
        carryOverRef.current = cloneDesign(loaded);
      } else {
        setFormData(
          carryOverRef.current
            ? { ...cloneDesign(carryOverRef.current), certiType: certType }
            : blankFormData(certType)
        );
      }
      setIsCertificateLoading(false);
    };

    loadDesign();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, eventId, formData.certiType]);

  // Copies a design saved on one of the owner's other events into the form,
  // under the type being edited here. Images come across as the addresses they
  // were already uploaded to, so nothing has to be re-uploaded. Like the
  // carry-over between types, this only fills the form — the design reaches
  // this event when the user saves it.
  const handleImportDesign = (doc) => {
    const imported = buildFormDataFromDoc(doc, formData.certiType);
    setSelectedFiles([]);
    setFormData(imported);
    // The other types copy from whatever was last loaded, so an import is what
    // they should start from as well.
    carryOverRef.current = cloneDesign(imported);
  };

  const handleFileChange = (e, fieldName, index) => {
    const file = e.target.files[0];
    setFormData((prevData) => {
      const updatedField = [...prevData[fieldName]];
      // For signatures, update the specific property of the signature object
      const signatureField = 'url';
      if (fieldName === 'signatures') {
        setSelectedFiles((prevFiles) => {
          const s = `signatures[${index}].url.url`;
          const obj = { [s]: file };
          let alreadyExists = 0;
          prevFiles.forEach((file, index) => {
            for (const key in file) {
              if (key == s) {
                alreadyExists = index;
              }
            }
          });
          if (alreadyExists !== 0) {
            const updated = [...prevFiles];
            updated[alreadyExists] = obj;
            return updated;
          }
          return [...prevFiles, obj];
        });
        console.log(selectedFiles);
        const signField = 'url';
        updatedField[index][signatureField] = {
          ...updatedField[index][signatureField],
          [signField]: URL.createObjectURL(file),
        };
      } else {
        updatedField[index] = {
          ...updatedField[index],
          [signatureField]: URL.createObjectURL(file),
        };
      }
      return {
        ...prevData,
        [fieldName]: updatedField,
      };
    });
  };
  const handleChangeStyle = (event, fieldName, index) => {
    if (event.target.checked) {
      const value = event.target.name.split('.').pop();
      if (fieldName === 'signatures') {
        setFormData((prevData) => {
          const updatedField = [...prevData[fieldName]];
          const signatureField = event.target.name.split('.')[1];
          if (signatureField == 'name' || signatureField == 'position') {
            const signField = event.target.name.split('.')[2];
            updatedField[index][signatureField] = {
              ...updatedField[index][signatureField],
              [signField]: value,
            };
          }
          return {
            ...prevData,
            [fieldName]: updatedField,
          };
        });
      } else if (fieldName === 'body' || fieldName === 'certificateOf') {
        setFormData((prevData) => {
          const updatedField = prevData[fieldName];
          const objectField = event.target.name.split('.')[1];
          updatedField[objectField] = value;
          return {
            ...prevData,
            [fieldName]: updatedField,
          };
        });
      } else {
        setFormData((prevData) => {
          const updatedField = [...prevData[fieldName]];
          const objectField = event.target.name.split('.')[1];
          updatedField[index] = {
            ...updatedField[index],
            [objectField]: value,
          };
          return {
            ...prevData,
            [fieldName]: updatedField,
          };
        });
      }
    } else {
      const value = 'normal';
      if (fieldName === 'signatures') {
        setFormData((prevData) => {
          const updatedField = [...prevData[fieldName]];
          const signatureField = event.target.name.split('.')[1];
          if (signatureField == 'name' || signatureField == 'position') {
            const signField = event.target.name.split('.')[2];
            updatedField[index][signatureField] = {
              ...updatedField[index][signatureField],
              [signField]: value,
            };
          }
          return {
            ...prevData,
            [fieldName]: updatedField,
          };
        });
      } else if (fieldName === 'body' || fieldName === 'certificateOf') {
        setFormData((prevData) => {
          const updatedField = prevData[fieldName];
          const objectField = event.target.name.split('.')[1];
          updatedField[objectField] = value;
          return {
            ...prevData,
            [fieldName]: updatedField,
          };
        });
      } else {
        setFormData((prevData) => {
          const updatedField = [...prevData[fieldName]];
          const objectField = event.target.name.split('.')[1];
          updatedField[index] = {
            ...updatedField[index],
            [objectField]: value,
          };
          return {
            ...prevData,
            [fieldName]: updatedField,
          };
        });
      }
    }
  };
  const templateOptions = [
    { id: 0, label: 'Basic 1', imageUrl: '/templatebg/basic01.png' },
    { id: 1, label: 'Basic 2', imageUrl: '/templatebg/basic02.png' },
    { id: 2, label: 'Basic 3', imageUrl: '/templatebg/basic03.png' },
    { id: 3, label: 'Basic 4', imageUrl: '/templatebg/basic04.png' },
    { id: 4, label: 'Basic 5', imageUrl: '/templatebg/basic05.png' },
    { id: 5, label: 'Basic 6', imageUrl: '/templatebg/basic06.png' },
    { id: 6, label: 'Basic 7', imageUrl: '/templatebg/basic07.png' },
    { id: 7, label: 'Basic 8', imageUrl: '/templatebg/basic08.png' },
    { id: 8, label: 'Basic 9', imageUrl: '/templatebg/basic09.png' },
    { id: 16, label: 'Basic 10', imageUrl: '/templatebg/basic11.png' },
    { id: 18, label: 'Basic 11', imageUrl: '/templatebg/basic13.png' },
    { id: 19, label: 'Basic 12', imageUrl: '/templatebg/basic14.png' },
    { id: 9, label: 'Premium 1', imageUrl: '/templatebg/premium01.png' },
    { id: 10, label: 'Premium 2', imageUrl: '/templatebg/premium02.png' },
    { id: 11, label: 'Premium 3', imageUrl: '/templatebg/premium03.png' },
    { id: 12, label: 'Premium 4', imageUrl: '/templatebg/premium04.png' },
    { id: 14, label: 'Premium 5', imageUrl: '/templatebg/premium05.png' },
    { id: 15, label: 'Premium 6', imageUrl: '/templatebg/premium06.png' },
    { id: 22, label: 'Premium 7', imageUrl: '/templatebg/premium07.png' },
    { id: 13, label: 'Premium 8', imageUrl: '/templatebg/basic10.png' },
    { id: 17, label: 'Premium 9', imageUrl: '/templatebg/basic12.png' },
    { id: 21, label: 'Premium 10', imageUrl: '/templatebg/basic16.png' },
    { id: 23, label: 'Basic 14', imageUrl: '/templatebg/basic17.svg' },
    { id: 25, label: 'Premium 11', imageUrl: '/templatebg/premium08.svg' },
  ];
  const handleTemplateSelect = (id) => {
    setFormData((prevState) => ({
      ...prevState,
      templateId: id,
    }));
  };
  const handleChange = (e, fieldName, index) => {
    const { value } = e.target;

    if (fieldName === 'templateId') {
      setFormData((prevData) => ({
        ...prevData,
        [fieldName]: value,
      }));
    }
    if (
      fieldName === 'logos' ||
      fieldName === 'header' ||
      fieldName === 'signatures' ||
      fieldName === 'title'
    ) {
      setFormData((prevData) => {
        const updatedField = [...prevData[fieldName]];
        if (index !== null) {
          // For signatures, update the specific property of the signature object
          if (fieldName === 'signatures') {
            const signatureField = e.target.name.split('.')[1]; // Extract the property name (name, position, url)
            if (
              signatureField == 'name' ||
              signatureField == 'position' ||
              signatureField == 'url'
            ) {
              const signField = e.target.name.split('.')[2];
              updatedField[index][signatureField] = {
                ...updatedField[index][signatureField],
                [signField]: value,
              };
            } else {
              updatedField[index] = {
                ...updatedField[index],
                [signatureField]: value,
              };
            }
          } else {
            const objectField = e.target.name.split('.')[1];
            updatedField[index] = {
              ...updatedField[index],
              [objectField]:
                objectField == 'fontSize'
                  ? isNaN(parseInt(value))
                    ? 6
                    : parseInt(value)
                  : value,
            };
          }
        }

        return {
          ...prevData,
          [fieldName]: updatedField,
        };
      });
    } else if (
      fieldName === 'body' ||
      fieldName === 'footer' ||
      fieldName === 'certificateOf'
    ) {
      setFormData((prevData) => {
        const updatedField = prevData[fieldName];
        const objectField = e.target.name.split('.')[1];
        updatedField[objectField] = value;
        return {
          ...prevData,
          [fieldName]: updatedField,
        };
      });
    } else if (fieldName === 'certiType' || fieldName === 'verifiableLink') {
      setFormData((prevData) => ({
        ...prevData,
        [fieldName]: value,
      }));
    }
  };

  const handleChangec = (e, fieldName, name, index) => {
    const target = { name: name, value: e };
    const event = { target };
    handleChange(event, fieldName, index);
  };

  const removeBackground = (image, e, fieldName, index) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;
    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Simple background removal by setting white pixels to transparent
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      if (red > 200 && green > 200 && blue > 200) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    context.putImageData(imageData, 0, 0);

    const processedImage = new window.Image();
    processedImage.src = canvas.toDataURL();
    processedImage.onload = () => {
      console.log('Image processed');
    };

    // Convert canvas content to Blob
    canvas.toBlob(function (blob) {
      // Create a File object from Blob
      const result = new File([blob], 'processed-image.png', {
        type: 'image/png',
      });
      const event = { target: { files: [result], name: e.target.name } };
      handleFileChange(event, fieldName, index);
    });
  };

  const bgremove = async (e, fieldName, index) => {
    let file;
    if (e.target.value.includes('blob:')) {
      const response = await fetch(`${e.target.value}`);
      const b = await response.blob();
      file = new File([b], 'image/png');
      console.log(file);
    } else if (!(e.target.value == '[object File]')) {
      const response = await fetch(
        `${apiUrl}/proxy-image?url=${e.target.value}`
      );
      const b = await response.blob();
      file = new File([b], 'image/png');
    } else {
      file = formData.signatures[index].url.url;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {
      const img = new window.Image();
      img.src = reader.result;
      img.onload = () => {
        removeBackground(img, e, fieldName, index);
      };
    };
  };

  const addField = (fieldName) => {
    if (fieldName === 'signatures') {
      setFormData((prevData) => ({
        ...prevData,
        [fieldName]: [
          ...prevData[fieldName],
          {
            name: {
              name: '',
              fontSize: '',
              fontFamily: '',
              bold: 'normal',
              italic: 'normal',
            },
            position: {
              position: '',
              fontSize: '',
              fontFamily: '',
              bold: 'normal',
              italic: 'normal',
            },
            url: { url: '', size: 100 },
          },
        ],
      }));
    } else if (fieldName === 'logos') {
      setFormData((prevData) => ({
        ...prevData,
        [fieldName]: [
          ...prevData[fieldName],
          { url: '', height: 80, width: 80 },
        ],
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [fieldName]: [...prevData[fieldName], {}],
      }));
    }
  };

  const handleDelete = (fieldName, index) => {
    const updatedField = [...formData[fieldName]];
    updatedField.splice(index, 1);

    setFormData((prevData) => ({
      ...prevData,
      [fieldName]: updatedField,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const form = document.getElementById('form');
      const formdata = new FormData(form);
      selectedFiles.forEach((file) => {
        for (const key in file) {
          formdata.append(key, file[key]);
        }
      });
      formdata.append('url', window.location.origin);
      const response = await fetch(
        `${apiUrl}/certificatemodule/certificate/content/${eventId}`,
        {
          method: 'POST',
          // headers: {
          //   'Content-Type': 'multipart/form-data'
          // },

          credentials: 'include',
          body: formdata,
        }
      );

      if (response.ok) {
        console.log('resoponse okay');
        const responseData = await response.json();
        // console.log(responseData);
        toast({
          title: 'Submission successfull',
          description: responseData.message,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });

        // Re-read what was actually stored: images only get their final URL on
        // the server, so this is the version another type can be copied from.
        const savedDoc = await fetchCertificateDoc(formData.certiType);
        if (savedDoc) {
          const savedForm = buildFormDataFromDoc(savedDoc, formData.certiType);
          setSelectedFiles([]);
          setFormData(savedForm);
          carryOverRef.current = cloneDesign(savedForm);
        }
      } else {
        console.error('Error submitting form:', response.statusText);
        toast({
          title: 'Submission Failed',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Submission Failed',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // The editor owns the caret, so insertion is its job; this only forwards the
  // click on a variable button.
  function insertBodyVariable(variable) {
    bodyEditorRef.current?.insertVariable(variable);
  }

  function handleBodyTextChange(bodyText) {
    setFormData((prevData) => ({
      ...prevData,
      body: { ...prevData.body, body: bodyText },
    }));
  }

  const fontsizeopt = [];
  for (let i = 6; i <= 60; i = i + 2) {
    fontsizeopt.push(i);
  }
  // const fontStyleopt = [
  //   'fantasy',
  //   'monospace',
  //   'sans-serif',
  //   'serif',
  //   'cursive',
  // ];
  const fontStyleopt = [
    'fantasy',
    'monospace',
    'sans-serif',
    'serif',
    'cursive',
    'Playfair Display',
    'Euphoria Script',
    'Cookie',
    'UnifrakturCook',
    'Allura',
    'Alex Brush',
    'Libre Caslon Display',
    'Special Elite',
    'Monoton',
    'Dancing Script',
    'Playwrite DE Grund',
    'Noto Serif Devanagari',
    'Ingrid Darling',
    'Grey Qo',
    'Kings',
    'Ole',
    'Rubik Maze',
    'Rubik Burned',
    'Rubik Marker Hatch',
    'Rubik Microbe',
    'Blaka Ink',
    'Noto Serif Grantha',
    'Rubik Spray Paint',
    'Rubik Wet Paint',
    'Finger Paint',
    'Rubik Bubbles',
    'Oleo Script',
    'Neuton',
    'Merienda',
    'Concert One',
    'Permanent Marker',
    'Abril Fatface',
    'Rowdies',
    'Lobster',
    'Pacifico',
    'Anton SC',
    'Ga Maamli',
    'Libre Baskerville',
    'Libre Baskerville',
    'Merriweather',
    'Roboto Slab',
    'Roboto',
    'Oswald',
  ];

  // Saved certificates carry the type as free text, so a stray capital or the
  // British spelling of "organiser" must still find its colour.
  const activeType = certiTypeStyle(formData.certiType);

  // Applied while dragging in the preview, and by the place/reset buttons.
  const updateLogoPlacement = useCallback((index, patch) => {
    setFormData((prev) => {
      const logos = [...prev.logos];
      if (!logos[index]) return prev;
      logos[index] = { ...logos[index], ...patch };
      return { ...prev, logos };
    });
  }, []);

  // Uploading from the logos section adds the logo itself: it fills the first
  // empty slot, or appends a new one. The file is queued under the row's field
  // name so it reaches the server the same way a per-row upload does.
  const handleNewLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const emptySlot = formData.logos.findIndex((logo) => !logo.url);
    const index = emptySlot === -1 ? formData.logos.length : emptySlot;
    const objectUrl = URL.createObjectURL(file);

    setFormData((prev) => {
      const logos = [...prev.logos];
      if (index < logos.length) {
        logos[index] = { ...logos[index], url: objectUrl, x: null, y: null };
      } else {
        logos.push({ url: objectUrl, width: 80, height: 80, x: null, y: null });
      }
      return { ...prev, logos };
    });

    const field = `logos[${index}].url`;
    setSelectedFiles((prev) => {
      const existing = prev.findIndex((entry) => field in entry);
      if (existing === -1) return [...prev, { [field]: file }];
      const updated = [...prev];
      updated[existing] = { [field]: file };
      return updated;
    });

    e.target.value = '';
  };

  const updateQrPlacement = useCallback((patch) => {
    setFormData((prev) => ({
      ...prev,
      qr: { ...(prev.qr || { size: 100 }), ...patch },
    }));
  }, []);

  const resetQrPlacement = () => updateQrPlacement({ x: null, y: null });

  // `size` lands on the signature image; the coordinates on the block itself.
  const updateSignaturePlacement = useCallback((index, patch) => {
    setFormData((prev) => {
      const signatures = [...prev.signatures];
      const current = signatures[index];
      if (!current) return prev;
      const { size, ...placement } = patch;
      signatures[index] = {
        ...current,
        ...placement,
        ...(size === undefined
          ? {}
          : { url: { ...(current.url || {}), size } }),
      };
      return { ...prev, signatures };
    });
  }, []);

  const updateSignatureLine = useCallback((index, patch) => {
    setFormData((prev) => {
      const signatures = [...prev.signatures];
      const current = signatures[index];
      if (!current) return prev;
      signatures[index] = {
        ...current,
        line: { ...(current.line || {}), ...patch },
      };
      return { ...prev, signatures };
    });
  }, []);

  // `field` is 'name' or 'position'. Only the coordinates live here; the font
  // settings on the same object are edited through the form.
  // Removes a signature outright, or empties the last one left so the section
  // never ends up with no rows at all.
  const handleDeleteSignature = (index) => {
    const label =
      formData.signatures[index]?.name?.name?.trim() || `Signature ${index + 1}`;
    const removing = formData.signatures.length > 1;
    const confirmed = window.confirm(
      removing ? `Delete ${label}?` : `Clear ${label}?`
    );
    if (!confirmed) return;

    if (removing) {
      handleDelete('signatures', index);
    } else {
      setFormData((prev) => {
        const signatures = [...prev.signatures];
        signatures[index] = getDefaultSignature();
        return { ...prev, signatures };
      });
    }

    toast({
      title: removing ? 'Signature deleted' : 'Signature cleared',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const updateSignatureText = useCallback((index, field, patch) => {
    setFormData((prev) => {
      const signatures = [...prev.signatures];
      const current = signatures[index];
      if (!current) return prev;
      signatures[index] = {
        ...current,
        [field]: { ...(current[field] || {}), ...patch },
      };
      return { ...prev, signatures };
    });
  }, []);

  // Snapping the signature back takes its rule and both texts with it, so the
  // whole block reflows exactly as the template drew it.
  const resetSignaturePlacement = (index) => {
    updateSignaturePlacement(index, { x: null, y: null });
    updateSignatureLine(index, { x: null, y: null });
    updateSignatureText(index, 'name', { x: null, y: null });
    updateSignatureText(index, 'position', { x: null, y: null });
  };

  // Clearing the coordinates hands the logo back to the template, which the
  // preview then re-measures — so this reads as "snap back where it started".
  const resetLogoPlacement = (index) => {
    updateLogoPlacement(index, { x: null, y: null });
  };

  const setSplit = (value) => {
    const next = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));
    setSplitPct(next);
    try {
      window.localStorage.setItem(SPLIT_STORAGE_KEY, String(next));
    } catch (error) {
      /* storage unavailable — the layout just won't be remembered */
    }
  };

  const handleSplitterDown = (event) => {
    if (!isWide) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleSplitterKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSplit(splitPct - (event.shiftKey ? 10 : 2));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSplit(splitPct + (event.shiftKey ? 10 : 2));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSplit(DEFAULT_SPLIT);
    }
  };

  return (
    <Flex
      ref={shellRef}
      style={{
        height: '89dvh',
        clipPath: 'content-box',
        userSelect: isDragging ? 'none' : 'auto',
      }}
      className="tw-flex tw-flex-col md:tw-flex-row"
    >
      <Container
        maxW="full"
        // Plain white: the field and card borders wash out against a tinted
        // panel. The type's colour lives on the header card and the type
        // selector instead, where it does not sit behind any controls.
        bg="white"
        style={{
          height: '89dvh',
          overflowY: 'scroll',
          ...(isWide
            ? { flexBasis: `${splitPct}%`, flexGrow: 0, flexShrink: 0 }
            : {}),
        }}
        width={'100%'}
      >
        <Box
          mt={4}
          mb={4}
          px={5}
          py={4}
          borderRadius="2xl"
          // The card carries the type's colour too — the panel wash alone is
          // too pale to notice when switching types quickly.
          bgGradient={
            activeType
              ? `linear(to-r, ${activeType.scheme}.600, ${activeType.scheme}.400)`
              : 'linear(to-r, teal.600, blue.600)'
          }
          transition="background 150ms ease"
          color="white"
          boxShadow="md"
        >
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" opacity={0.85}>
            Certificate Module
          </Text>
          <Flex align="center" justify="space-between" gap={3} mt={1} wrap="wrap">
            <Heading size="md">Certificate Details</Heading>
            <Flex align="center" gap={3} wrap="wrap">
              <Button
                size="sm"
                leftIcon={<ArrowBackIcon />}
                variant="outline"
                color="white"
                borderColor="whiteAlpha.700"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={() => navigate('/cm/dashboard')}
              >
                Back to Dashboard
              </Button>
              {activeType && (
                <Box
                  bg="whiteAlpha.300"
                  borderRadius="full"
                  px={3}
                  py={1}
                  fontSize="xs"
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  {activeType.label}
                </Box>
              )}
            </Flex>
          </Flex>
          <Text mt={2} fontSize="sm" opacity={0.9}>
            Edit the fields below — the preview on the right updates as you type.
          </Text>
        </Box>

        <Box
          as="form"
          id="form"
          onSubmit={handleSubmit}
          borderRadius="15px"
          padding={4}
          marginBottom={7}
          borderColor="gray"
          boxShadow="0 0 15px rgba(0, 0, 0, 0.15)"
        >
          <VStack spacing={4} align="start" className="tw-mb-10">
            {/* Certificate Type Selection */}
            <Box
              width="100%"
              bg={activeType ? activeType.tint : 'gray.50'}
              borderWidth="1px"
              borderColor={activeType ? activeType.accent : 'gray.300'}
              borderLeftWidth="6px"
              borderRadius="10px"
              px={3}
              py={3}
              className="tw-flex tw-flex-row tw-gap-3 tw-items-center tw-justify-between"
            >
              <Text
                className="tw-font-bold tw-text-[17px]"
                color={activeType ? activeType.accent : 'gray.700'}
              >
                Certificate Type:
              </Text>
              <Select
                name="certiType"
                value={formData.certiType}
                onChange={(e) => handleChange(e, 'certiType', null)}
                placeholder="Select Certificate Type"
                maxWidth="220px"
                bg="white"
                fontWeight="bold"
                borderWidth="2px"
                borderColor={activeType ? activeType.accent : 'gray.300'}
                color="black"
                sx={{ '& option': { background: 'white', color: 'black' } }}
                borderRadius="7px"
                _hover={{ borderColor: activeType ? activeType.accent : 'gray.400' }}
              >
                {CERTI_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {CERTI_TYPE_STYLES[type].label}
                  </option>
                ))}
              </Select>
            </Box>

            {/* Starting point: rather than filling every field again for a new
                event, the whole design can be pulled in from an event that was
                already set up. */}
            <Flex
              width="100%"
              align="center"
              justify="space-between"
              gap={3}
              wrap="wrap"
              px={3}
              py={3}
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="10px"
              bg="gray.50"
            >
              <Box minW={0}>
                <Text className="tw-font-bold tw-text-[15px]" color="gray.700">
                  Start from an existing event
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Copies the text, logos, signatures and template across. Review
                  it, then save.
                </Text>
              </Box>
              <ImportCertificateDesign
                eventId={eventId}
                currentType={formData.certiType}
                onImport={handleImportDesign}
              />
            </Flex>

            {/* Title Fields */}
            <Box
              width="100%"
              className="tw-flex tw-flex-col tw-gap-3 tw-my-5 tw-px-2 tw-align-center"
            >
              <Text className="tw-font-bold tw-mb-1">
                Name of the Institute:
              </Text>

              {formData.title.length == 0
                ? (formData.title = [''])
                : formData.title.map((title, index) => (
                    <HStack key={index} alignItems="flex-start" width="100%">
                      <Accordion width="100%" allowMultiple>
                        <AccordionItem
                          border="none"
                          alignItems="center"
                          width="100%"
                        >
                          <HStack alignItems="center" width="100%">
                            <Input
                              name={`title[${index}].name`}
                              value={title.name}
                              onChange={(e) => handleChange(e, 'title', index)}
                              placeholder="Title"
                              width="100%"
                              borderWidth="1px"
                              borderColor="gray.300"
                              textColor="gray.700"
                              borderRadius="7px"
                            />
                            <AccordionButton
                              height="34px"
                              width="34px"
                              justifyContent="center"
                              borderRadius="8px"
                              _hover={{ bg: 'blue.50' }}
                            >
                              <EditIcon color="blue.500" boxSize="18px" />
                            </AccordionButton>

                            {index > 1 && (
                              <IconButton
                                size="sm"
                                icon={<CloseIcon color="red" boxSize="14px" />}
                                onClick={() => handleDelete('title', index)}
                              />
                            )}

                            {/*Add Another button is added below, so no need of it */}
                            {/* {index === formData.title.length - 1 && (
                              <IconButton
                                icon={
                                  <AddIcon
                                    color="green"
                                    width="20px"
                                    height="20px"
                                  />
                                }
                                onClick={() => addField('title')}
                              />
                            )} */}
                          </HStack>

                          {/* ACCORDION PANEL FOR TEXT SETTINGS */}
                          <AccordionPanel
                            bg="gray.50"
                            borderRadius="md"
                            p={3}
                            mt={2}
                          >
                            <HStack spacing="6" align="flex-start">
                              {/* LEFT: Text / Font Settings */}
                              <VStack spacing="3" align="stretch" flex="1">
                                <Text fontSize="sm" color="gray.600">
                                  Text settings
                                </Text>

                                <Select
                                  name={`title[${index}].fontSize`}
                                  value={title.fontSize}
                                  onChange={(e) =>
                                    handleChange(e, 'title', index)
                                  }
                                  placeholder="Size"
                                >
                                  {fontsizeopt.map((item, key) => (
                                    <option key={key} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </Select>

                                <Select
                                  name={`title[${index}].fontFamily`}
                                  value={title.fontFamily}
                                  onChange={(e) =>
                                    handleChange(e, 'title', index)
                                  }
                                  placeholder="Style"
                                >
                                  {fontStyleopt.map((item, key) => (
                                    <option key={key} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </Select>

                                <Input
                                  name={`title[${index}].fontColor`}
                                  value={title.fontColor}
                                  onChange={(e) =>
                                    handleChange(e, 'title', index)
                                  }
                                  placeholder="Color eg. black"
                                />

                                <HStack spacing="4" pt="1">
                                  <Checkbox
                                    name={`title[${index}].bold`}
                                    value={title.bold}
                                    isChecked={title.bold === 'bold'}
                                    onChange={(e) =>
                                      handleChangeStyle(e, 'title', index)
                                    }
                                  >
                                    Bold
                                  </Checkbox>

                                  <Checkbox
                                    name={`title[${index}].italic`}
                                    value={title.italic}
                                    isChecked={title.italic === 'italic'}
                                    onChange={(e) =>
                                      handleChangeStyle(e, 'title', index)
                                    }
                                  >
                                    Italic
                                  </Checkbox>
                                </HStack>
                              </VStack>

                              {/* DIVIDER */}
                              <Box
                                width="1px"
                                bg="gray.200"
                                alignSelf="stretch"
                              />

                              {/* RIGHT: Color Picker */}
                              <VStack spacing="2">
                                <Text fontSize="sm" color="gray.600">
                                  Color
                                </Text>

                                <Box
                                  border="1px solid"
                                  borderColor="gray.200"
                                  borderRadius="md"
                                  p="2"
                                >
                                  <HexAlphaColorPicker
                                    value={title.fontColor || '#000000'}
                                    onChange={(e) =>
                                      handleChangec(
                                        e,
                                        'title',
                                        `title[${index}].fontColor`,
                                        index
                                      )
                                    }
                                    style={{ width: '180px', height: '180px' }}
                                  />
                                </Box>
                              </VStack>
                            </HStack>
                          </AccordionPanel>
                        </AccordionItem>
                      </Accordion>
                    </HStack>
                  ))}

              {/* Add Another button */}
              <Button
                onClick={() => addField('title')}
                width="100%"
                height="45px"
                border="2px dashed"
                borderColor="green.400"
                color="green.500"
                bg="transparent"
                leftIcon={<AddIcon />}
                _hover={{ bg: 'green.50' }}
              >
                Add another
              </Button>
            </Box>

            {/* Template Selection */}
            <Box
              width="100%"
              className="tw-px-2 tw-my-5 tw-flex tw-flex-col tw-gap-3"
            >
              <Text className="tw-font-bold">Select Certificate Template:</Text>
              <Box
                width="100%"
                maxWidth="100%"
                overflowX="auto"
                whiteSpace="nowrap"
                padding="10px 0"
                borderWidth={'2px'}
                borderRadius={'8px'}
                borderColor={'gray.300'}
              >
                <HStack spacing={4} width="max-content">
                  {templateOptions.map((template) => (
                    <Box
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      border={
                        formData.templateId === template.id
                          ? '2px solid blue'
                          : '2px solid transparent'
                      }
                      borderRadius="md"
                      cursor="pointer"
                      padding="2px"
                    >
                      <Image src={template.imageUrl} alt={template.label} w={150} />
                      <Text w={150} fontSize="sm" textAlign="center">
                        {template.label}
                      </Text>
                    </Box>
                  ))}
                </HStack>
              </Box>
            </Box>
            <Input
              name={`templateId`}
              value={formData.templateId}
              // width="0px"
              display="none"
            />

            {/* Logos Fields */}
            <Box
              width="100%"
              className="tw-flex tw-flex-col tw-gap-2 tw-px-2 tw-my-2"
            >
              {/* Header */}
              <HStack align="center" spacing={1}>
                <Text fontWeight="bold">Logos: </Text>
                <Tooltip
                  label="Only JPG/PNG allowed. Maximum 4 logos."
                  placement="right"
                  hasArrow
                  fontSize="sm"
                >
                  <InfoIcon
                    color="gray.500"
                    cursor="pointer"
                    boxSize="14px"
                    _hover={{ color: 'gray.700' }}
                  />
                </Tooltip>
              </HStack>
              <Text fontSize="xs" color="teal.600">
                Drag a logo on the preview to set its position, and its corner to
                resize it.
              </Text>

              {formData.logos.map((logo, index) => (
                <Box
                  key={index}
                  width="100%"
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="8px"
                  px={3}
                  py={1}
                  _hover={{ borderColor: 'blue.200' }}
                >
                  <Accordion allowMultiple>
                    <AccordionItem border="none">
                      {/* Top Row */}
                      <HStack
                        width="100%"
                        justify="space-between"
                        align="center"
                      >
                        <Input
                          name={`logos[${index}].url`}
                          value={logo.url}
                          onChange={(e) => handleChange(e, 'logos', index)}
                          display="none"
                        />

                        {/* Thumbnail of what is actually on the certificate */}
                        <HStack spacing={3} align="center" flex="1" minW={0}>
                          {logo.url ? (
                            <Tooltip label="Click to replace this image" hasArrow>
                              <Box
                                as="label"
                                htmlFor={`logo${index}`}
                                boxSize="46px"
                                flexShrink={0}
                                borderWidth="1px"
                                borderColor="gray.200"
                                borderRadius="md"
                                bg="white"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                overflow="hidden"
                                cursor="pointer"
                                _hover={{ borderColor: 'purple.300' }}
                              >
                              <Image
                                src={logo.url}
                                alt={`Logo ${index + 1}`}
                                maxH="40px"
                                maxW="40px"
                                objectFit="contain"
                                />
                              </Box>
                            </Tooltip>
                          ) : (
                            <Box
                              as="label"
                              htmlFor={`logo${index}`}
                              boxSize="46px"
                              flexShrink={0}
                              border="2px dashed"
                              borderColor="gray.300"
                              borderRadius="md"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              cursor="pointer"
                              color="gray.400"
                              _hover={{ borderColor: 'purple.300', color: 'purple.400' }}
                            >
                              <FaUpload style={{ height: 16, width: 16 }} />
                            </Box>
                          )}

                          <Box minW={0}>
                            <Text fontSize="sm" fontWeight="semibold">
                              Logo {index + 1}
                            </Text>
                            <Text
                              fontSize="xs"
                              color={logo.url ? 'gray.500' : 'gray.400'}
                            >
                              {logo.url
                                ? `${Math.round(Number(logo.width) || 80)} × ${Math.round(
                                    Number(logo.height) || 80
                                  )} px`
                                : 'No image uploaded'}
                            </Text>
                          </Box>
                        </HStack>

                        <HStack spacing={2}>
                          {/* Kept in the form so the picked file is submitted
                              with the row — opened from the thumbnail. */}
                          <Input
                            id={`logo${index}`}
                            name={`logos[${index}].url`}
                            onChange={(e) =>
                              handleFileChange(e, 'logos', index)
                            }
                            type="file"
                            accept="image/jpeg , image/png"
                            style={{
                              width: 0,
                              height: 0,
                              padding: 0,
                              margin: 0,
                            }}
                          />

                          {/* Edit */}
                          <Tooltip label="Edit size and position" hasArrow>
                            <AccordionButton
                              height="32px"
                              width="32px"
                              borderRadius="md"
                              _hover={{ bg: 'blue.50' }}
                              justifyContent="center"
                            >
                              <EditIcon color="blue.500" boxSize="20px" />
                            </AccordionButton>
                          </Tooltip>

                          {/* Delete — removes the logo, or clears the image
                              when it is the only row left. */}
                          <Tooltip
                            label={index > 0 ? 'Remove this logo' : 'Remove this image'}
                            hasArrow
                          >
                            <IconButton
                              size="sm"
                              variant="ghost"
                              aria-label="Delete logo"
                              icon={<CloseIcon color="red.500" boxSize="14px" />}
                              _hover={{ bg: 'red.50' }}
                              isDisabled={index === 0 && !logo.url}
                              onClick={() =>
                                index > 0
                                  ? handleDelete('logos', index)
                                  : updateLogoPlacement(index, {
                                      url: '',
                                      x: null,
                                      y: null,
                                    })
                              }
                            />
                          </Tooltip>
                        </HStack>
                      </HStack>

                      {/* Advanced Settings */}
                      <AccordionPanel pt={2}>
                        <Box bg="gray.50" borderRadius="md" px={3} py={2}>
                          <HStack width="100%" spacing={4}>
                            <HStack width="60%">
                              <Text fontSize="sm">Vertical Position:</Text>
                              <input
                                type="number"
                                name={`logos[${index}].height`}
                                value={logo.height}
                                onChange={(e) =>
                                  handleChange(e, 'logos', index)
                                }
                                style={{
                                  width: '55px',
                                  textAlign: 'center',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                }}
                              />
                            </HStack>

                            <HStack width="40%">
                              <Text fontSize="sm">Size:</Text>
                              <input
                                type="number"
                                name={`logos[${index}].width`}
                                value={logo.width}
                                onChange={(e) =>
                                  handleChange(e, 'logos', index)
                                }
                                style={{
                                  width: '55px',
                                  textAlign: 'center',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                }}
                              />
                            </HStack>
                          </HStack>

                          {/* The form is submitted as FormData, so placement has
                              to travel as real inputs. They are only rendered
                              for placed logos — no inputs means no coordinates,
                              which is how the old layout stays untouched. */}
                          {isPlacedLogo(logo) && (
                            <>
                              <input
                                type="hidden"
                                name={`logos[${index}].x`}
                                value={Math.round(Number(logo.x))}
                                readOnly
                              />
                              <input
                                type="hidden"
                                name={`logos[${index}].y`}
                                value={Math.round(Number(logo.y))}
                                readOnly
                              />
                            </>
                          )}

                          {/* Position is edited on the preview itself. */}
                          {isPlacedLogo(logo) && (
                            <HStack width="100%" spacing={3} mt={3} align="center">
                              <Text fontSize="sm" color="gray.600">
                                Position: {Math.round(Number(logo.x))},{' '}
                                {Math.round(Number(logo.y))} — drag it on the preview
                              </Text>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => resetLogoPlacement(index)}
                              >
                                Snap back
                              </Button>
                            </HStack>
                          )}
                        </Box>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </Box>
              ))}

              {/* Upload straight from here — picking a file adds the logo. */}
              {formData.logos.length < 4 && (
                <Box
                  as="label"
                  htmlFor="logo-upload-new"
                  width="100%"
                  minHeight="52px"
                  border="2px dashed"
                  borderColor="green.400"
                  borderRadius="8px"
                  color="green.600"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                  cursor="pointer"
                  _hover={{ bg: 'green.50', borderColor: 'green.500' }}
                >
                  <FaUpload style={{ height: 16, width: 16 }} />
                  <Text fontSize="sm" fontWeight="semibold">
                    Upload logo
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    JPG or PNG · up to 4
                  </Text>
                </Box>
              )}
              <input
                id="logo-upload-new"
                type="file"
                accept="image/jpeg , image/png"
                onChange={handleNewLogoFile}
                style={{ display: 'none' }}
              />
            </Box>

            {/* Department and Club Fields */}
            <Box
              width="100%"
              className="tw-flex tw-flex-col tw-gap-2 tw-px-2 tw-my-3"
            >
              {/* Header */}
              <Text fontWeight="bold">Enter Department or Club</Text>

              {formData.header.map((header, index) => (
                <Box key={index} width="100%">
                  <Accordion allowMultiple>
                    <AccordionItem border="none">
                      {/* Top Row */}
                      <HStack
                        width="100%"
                        justify="space-between"
                        align="center"
                      >
                        <Input
                          name={`header[${index}].header`}
                          value={header.header}
                          onChange={(e) => handleChange(e, 'header', index)}
                          placeholder="Department or Club Name"
                          borderWidth="2px"
                          borderColor="gray.300"
                          textColor="gray.700"
                          borderRadius="7px"
                        />

                        <HStack spacing={2}>
                          {/* Edit */}
                          <AccordionButton
                            height="32px"
                            width="32px"
                            borderRadius="md"
                            _hover={{ bg: 'blue.50' }}
                            justifyContent="center"
                          >
                            <EditIcon color="blue.500" boxSize="20px" />
                          </AccordionButton>

                          {/* Delete */}
                          {index > 0 && (
                            <IconButton
                              size="sm"
                              icon={<CloseIcon color="red" boxSize="14px" />}
                              onClick={() => handleDelete('header', index)}
                            />
                          )}

                          {/* Add */}
                          {index === formData.header.length - 1 && (
                            <IconButton
                              size="sm"
                              icon={<AddIcon color="green" boxSize="14px" />}
                              onClick={() => addField('header')}
                            />
                          )}
                        </HStack>
                      </HStack>

                      {/* Advanced Settings */}
                      <AccordionPanel pt={3}>
                        <Box bg="gray.50" borderRadius="md" px={3} py={3}>
                          <HStack spacing={6} align="flex-start">
                            <VStack align="start" spacing={3}>
                              <Select
                                name={`header[${index}].fontSize`}
                                value={header.fontSize}
                                onChange={(e) =>
                                  handleChange(e, 'header', index)
                                }
                                placeholder="Font Size"
                              >
                                {fontsizeopt.map((item, key) => (
                                  <option key={key} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </Select>

                              <Select
                                name={`header[${index}].fontFamily`}
                                value={header.fontFamily}
                                onChange={(e) =>
                                  handleChange(e, 'header', index)
                                }
                                placeholder="Font Style"
                              >
                                {fontStyleopt.map((item, key) => (
                                  <option key={key} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </Select>

                              <Input
                                name={`header[${index}].fontColor`}
                                value={header.fontColor}
                                onChange={(e) =>
                                  handleChange(e, 'header', index)
                                }
                                placeholder="Color (eg. red / #000000)"
                              />

                              <HStack spacing={4}>
                                <Checkbox
                                  name={`header[${index}].bold`}
                                  value={header.bold}
                                  isChecked={header.bold === 'bold'}
                                  onChange={(e) =>
                                    handleChangeStyle(e, 'header', index)
                                  }
                                >
                                  Bold
                                </Checkbox>

                                <Checkbox
                                  name={`header[${index}].italic`}
                                  value={header.italic}
                                  isChecked={header.italic === 'italic'}
                                  onChange={(e) =>
                                    handleChangeStyle(e, 'header', index)
                                  }
                                >
                                  Italic
                                </Checkbox>
                              </HStack>
                            </VStack>

                            {/* Color Picker */}
                            <HexAlphaColorPicker
                              name={`header[${index}].fontColor`}
                              value={header.fontColor}
                              onChange={(e) =>
                                handleChangec(
                                  e,
                                  'header',
                                  `header.fontColor`,
                                  index
                                )
                              }
                            />
                          </HStack>
                        </Box>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </Box>
              ))}
            </Box>

            {/* CERTIFICATE DETAILS */}
            <Box
              width="100%"
              className="tw-px-2 tw-my-2 tw-mb-4 tw-flex tw-flex-col "
            >
              <Accordion width="100%" allowMultiple>
                <AccordionItem width="100%" border="none">
                  <HStack width="100%" justifyContent="space-between">
                    <Text className="tw-font-bold">Certificate:</Text>
                  </HStack>
                  <VStack width="100%">
                    <HStack width="100%">
                      <Input
                        name="certificateOf.certificateOf"
                        value={formData.certificateOf.certificateOf}
                        onChange={(e) => handleChange(e, 'certificateOf', null)}
                        placeholder="Type of Certificate (e.g., Certificate of Participation)"
                        width="100%"
                        borderWidth="2px"
                        borderColor="gray.300"
                        textColor="gray.700"
                        borderRadius="7px"
                      />
                      <AccordionButton
                        height="32px"
                        width="32px"
                        borderRadius="md"
                        _hover={{ bg: 'blue.50' }}
                        justifyContent="center"
                      >
                        <EditIcon color="blue.500" boxSize="20px" />
                      </AccordionButton>
                    </HStack>
                    <AccordionPanel>
                      <VStack width="100%">
                        <HStack>
                          <VStack>
                            <Select
                              name={`certificateOf.fontSize`}
                              value={formData.certificateOf.fontSize}
                              onChange={(e) =>
                                handleChange(e, 'certificateOf', null)
                              }
                              placeholder="Size"
                            >
                              {fontsizeopt.map((item, key) => {
                                return (
                                  <option key={key} value={`${item}`}>
                                    {item}
                                  </option>
                                );
                              })}
                            </Select>
                            <Select
                              name={`certificateOf.fontFamily`}
                              value={formData.certificateOf.fontFamily}
                              onChange={(e) =>
                                handleChange(e, 'certificateOf', null)
                              }
                              placeholder="Style"
                            >
                              {fontStyleopt.map((item, key) => {
                                return (
                                  <option key={key} value={`${item}`}>
                                    {item}
                                  </option>
                                );
                              })}
                            </Select>
                            <Input
                              name={`certificateOf.fontColor`}
                              value={formData.certificateOf.fontColor}
                              onChange={(e) =>
                                handleChange(e, 'certificateOf', null)
                              }
                              placeholder="Color eg. red"
                            ></Input>
                            <HStack>
                              <Checkbox
                                name={`certificateOf.bold`}
                                value={formData.certificateOf.bold}
                                isChecked={
                                  formData.certificateOf.bold == 'bold'
                                }
                                onChange={(e) =>
                                  handleChangeStyle(e, 'certificateOf', null)
                                }
                              >
                                Bold
                              </Checkbox>
                              <Checkbox
                                name={`certificateOf.italic`}
                                value={formData.certificateOf.italic}
                                isChecked={
                                  formData.certificateOf.italic == 'italic'
                                }
                                onChange={(e) =>
                                  handleChangeStyle(e, 'certificateOf', null)
                                }
                              >
                                Italic
                              </Checkbox>
                            </HStack>
                          </VStack>
                          <HexAlphaColorPicker
                            name={`certificateOf.fontColor`}
                            value={formData.certificateOf.fontColor}
                            onChange={(e) =>
                              handleChangec(
                                e,
                                'certificateOf',
                                `certificateOf.fontColor`,
                                null
                              )
                            }
                          />
                        </HStack>
                      </VStack>
                    </AccordionPanel>
                  </VStack>
                </AccordionItem>
              </Accordion>
            </Box>

            {/* Body of the certificate */}
            <Box
              width="100%"
              className="tw-px-2 tw-my-2 tw-mb-4 tw-flex tw-flex-col"
            >
              <Accordion width="100%" allowMultiple>
                <AccordionItem width="100%" border="none">
                  {/* Header */}
                  <HStack width="100%" justifyContent="space-between" mb={2}>
                    <HStack spacing={2}>
                      <Text fontWeight="bold">Body of the certificate</Text>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const el = document.getElementById('bodyVariables');
                          el.style.display =
                            el.style.display === 'block' ? 'none' : 'block';
                        }}
                      >
                        See variables
                      </Button>
                    </HStack>

                    <AccordionButton
                      height="32px"
                      width="32px"
                      borderRadius="md"
                      _hover={{ bg: 'blue.50' }}
                      justifyContent="center"
                    >
                      <EditIcon color="blue.500" boxSize="20px" />
                    </AccordionButton>
                  </HStack>

                  {/* Variables Panel */}
                  <Box
                    id="bodyVariables"
                    display="none"
                    mb={3}
                    p={3}
                    bg="gray.50"
                    border="1px dashed"
                    borderColor="gray.300"
                    borderRadius="6px"
                  >
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      Click to insert at the cursor
                    </Text>

                    <HStack wrap="wrap" spacing={2}>
                      {BODY_VARIABLES.map((item) => (
                        <Button
                          key={item}
                          type="button"
                          size="sm"
                          variant="outline"
                          color="blue.700"
                          borderColor="blue.200"
                          bg="blue.50"
                          _hover={{ bg: 'blue.100' }}
                          onClick={() => insertBodyVariable(item)}
                        >
                          {item}
                        </Button>
                      ))}
                    </HStack>
                  </Box>

                  {/* Body Text */}
                  <VStack width="100%" spacing={3}>
                    <BodyEditor
                      apiRef={bodyEditorRef}
                      value={formData.body.body}
                      onChange={handleBodyTextChange}
                      placeholder="Write the certificate body, and click a variable above to drop it in"
                    />

                    {/* The editor is a contentEditable, which a form does not
                        submit. This carries its text into the FormData under
                        the name the server reads. */}
                    <input
                      type="hidden"
                      name="body.body"
                      value={formData.body.body || ''}
                      readOnly
                    />

                    {/* The body only fills in for columns the sheet actually
                        carries, and the match is on the exact variable name. */}
                    <Box width="100%">
                      <Text fontSize="sm" color="gray.600">
                        The variables used above must be uploaded as columns in
                        the participant details sheet. Use the variable names
                        exactly as they are:
                      </Text>
                      <Text
                        fontSize="sm"
                        fontWeight="semibold"
                        color="blue.700"
                        mt={1}
                      >
                        {BODY_VARIABLES.join(', ')}
                      </Text>
                    </Box>

                    {/* Advanced Settings */}
                    <AccordionPanel pt={2} width="100%">
                      <Box
                        bg="gray.50"
                        borderRadius="md"
                        px={3}
                        py={3}
                        width="100%"
                      >
                        <HStack align="flex-start" spacing={6}>
                          <VStack align="start" spacing={3}>
                            <Select
                              name="body.fontSize"
                              value={formData.body.fontSize}
                              onChange={(e) => handleChange(e, 'body', null)}
                              placeholder="Font Size"
                            >
                              {fontsizeopt.map((item, key) => (
                                <option key={key} value={item}>
                                  {item}
                                </option>
                              ))}
                            </Select>

                            <Select
                              name="body.fontFamily"
                              value={formData.body.fontFamily}
                              onChange={(e) => handleChange(e, 'body', null)}
                              placeholder="Font Style"
                            >
                              {fontStyleopt.map((item, key) => (
                                <option key={key} value={item}>
                                  {item}
                                </option>
                              ))}
                            </Select>

                            <Input
                              name="body.fontColor"
                              value={formData.body.fontColor}
                              onChange={(e) => handleChange(e, 'body', null)}
                              placeholder="Color (eg. red / #000000)"
                            />

                            <HStack spacing={4}>
                              <Checkbox
                                name="body.bold"
                                value={formData.body.bold}
                                isChecked={formData.body.bold === 'bold'}
                                onChange={(e) =>
                                  handleChangeStyle(e, 'body', null)
                                }
                              >
                                Bold
                              </Checkbox>

                              <Checkbox
                                name="body.italic"
                                value={formData.body.italic}
                                isChecked={formData.body.italic === 'italic'}
                                onChange={(e) =>
                                  handleChangeStyle(e, 'body', null)
                                }
                              >
                                Italic
                              </Checkbox>
                            </HStack>
                          </VStack>

                          {/* Color Picker */}
                          <HexAlphaColorPicker
                            name="body.fontColor"
                            value={formData.body.fontColor}
                            onChange={(e) =>
                              handleChangec(e, 'body', 'body.fontColor', null)
                            }
                          />
                        </HStack>
                      </Box>
                    </AccordionPanel>
                  </VStack>
                </AccordionItem>
              </Accordion>
            </Box>

            {/* Signatures Fields */}
            <Box
              width="100%"
              className="tw-px-2 tw-my-4 tw-flex tw-flex-col tw-gap-3"
            >
              {/* Section Header */}
              <Text fontWeight="bold">Signatures</Text>
              <Text fontSize="xs" color="teal.600" mt={-2}>
                Drag a signature — and the line above the name — on the preview to
                set its position, and its corner to resize it.
              </Text>

              {formData.signatures.map((signature, index) => (
                <Box
                  key={index}
                  width="100%"
                  border="2px solid"
                  borderColor="gray.200"
                  borderRadius="8px"
                  px={3}
                  py={3}
                  _hover={{ borderColor: 'blue.300' }}
                >
                  <VStack width="100%" spacing={3}>
                    {/* Placement travels only once the block has been moved,
                        so signatures saved earlier stay where the template
                        put them. */}
                    {isPlacedSignature(signature) && (
                      <HStack width="100%" spacing={3} align="center">
                        <input
                          type="hidden"
                          name={`signatures[${index}].x`}
                          value={Math.round(Number(signature.x))}
                          readOnly
                        />
                        <input
                          type="hidden"
                          name={`signatures[${index}].y`}
                          value={Math.round(Number(signature.y))}
                          readOnly
                        />
                        {isPlacedText(signature.name) && (
                          <>
                            <input
                              type="hidden"
                              name={`signatures[${index}].name.x`}
                              value={Math.round(Number(signature.name.x))}
                              readOnly
                            />
                            <input
                              type="hidden"
                              name={`signatures[${index}].name.y`}
                              value={Math.round(Number(signature.name.y))}
                              readOnly
                            />
                          </>
                        )}
                        {isPlacedText(signature.position) && (
                          <>
                            <input
                              type="hidden"
                              name={`signatures[${index}].position.x`}
                              value={Math.round(Number(signature.position.x))}
                              readOnly
                            />
                            <input
                              type="hidden"
                              name={`signatures[${index}].position.y`}
                              value={Math.round(Number(signature.position.y))}
                              readOnly
                            />
                          </>
                        )}
                        {isPlacedLine(signature.line) && (
                          <>
                            <input
                              type="hidden"
                              name={`signatures[${index}].line.x`}
                              value={Math.round(Number(signature.line.x))}
                              readOnly
                            />
                            <input
                              type="hidden"
                              name={`signatures[${index}].line.y`}
                              value={Math.round(Number(signature.line.y))}
                              readOnly
                            />
                            <input
                              type="hidden"
                              name={`signatures[${index}].line.width`}
                              value={Math.round(Number(signature.line.width) || 100)}
                              readOnly
                            />
                          </>
                        )}
                        <Text fontSize="xs" color="gray.600" flex="1" minW={0}>
                          Position: {Math.round(Number(signature.x))},{' '}
                          {Math.round(Number(signature.y))} — drag it, and the line
                          above the name, on the preview
                        </Text>
                        <Button
                          size="xs"
                          variant="outline"
                          flexShrink={0}
                          onClick={() => resetSignaturePlacement(index)}
                        >
                          Snap back
                        </Button>
                      </HStack>
                    )}

                    {/* Existing signatures, listed inline */}
                    <Box width="100%">
                      <Signaturemodal
                        eventId={eventId}
                        formData={formData}
                        setFormData={setFormData}
                        index={index}
                        handleFileChange={handleFileChange}
                        signatures={formData.signatures}
                        signature={signature}
                        handleChange={handleChange}
                        selectedFiles={selectedFiles}
                      />
                    </Box>

                    {/* NAME */}
                    <Accordion allowMultiple>
                      <AccordionItem border="none">
                        <HStack width="100%" justify="space-between" spacing={2}>
                          <Input
                            name={`signatures[${index}].name.name`}
                            value={signature.name.name}
                            onChange={(e) =>
                              handleChange(e, 'signatures', index)
                            }
                            placeholder="Name"
                            flex="1"
                            minW={0}
                          />

                          <AccordionButton
                            height="32px"
                            width="32px"
                            flexShrink={0}
                            borderRadius="md"
                            _hover={{ bg: 'blue.50' }}
                          >
                            <EditIcon color="blue.500" boxSize="18px" />
                          </AccordionButton>
                        </HStack>

                        <AccordionPanel pt={2}>
                          <Box bg="gray.50" p={3} borderRadius="md">
                            <HStack spacing={6} align="flex-start">
                              <VStack align="start" spacing={3}>
                                <Select
                                  name={`signatures[${index}].name.fontSize`}
                                  value={signature.name.fontSize}
                                  onChange={(e) =>
                                    handleChange(e, 'signatures', index)
                                  }
                                  placeholder="Font Size"
                                >
                                  {fontsizeopt.map((item, key) => (
                                    <option key={key} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </Select>

                                <Select
                                  name={`signatures[${index}].name.fontFamily`}
                                  value={signature.name.fontFamily}
                                  onChange={(e) =>
                                    handleChange(e, 'signatures', index)
                                  }
                                  placeholder="Font Style"
                                >
                                  {fontStyleopt.map((item, key) => (
                                    <option key={key} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </Select>

                                <Input
                                  name={`signatures[${index}].name.fontColor`}
                                  value={signature.name.fontColor}
                                  onChange={(e) =>
                                    handleChange(e, 'signatures', index)
                                  }
                                  placeholder="Color"
                                />

                                <HStack spacing={4}>
                                  <Checkbox
                                    name={`signatures[${index}].name.bold`}
                                    isChecked={signature.name.bold === 'bold'}
                                    onChange={(e) =>
                                      handleChangeStyle(e, 'signatures', index)
                                    }
                                  >
                                    Bold
                                  </Checkbox>

                                  <Checkbox
                                    name={`signatures[${index}].name.italic`}
                                    isChecked={
                                      signature.name.italic === 'italic'
                                    }
                                    onChange={(e) =>
                                      handleChangeStyle(e, 'signatures', index)
                                    }
                                  >
                                    Italic
                                  </Checkbox>
                                </HStack>
                              </VStack>

                              <HexAlphaColorPicker
                                value={signature.name.fontColor}
                                onChange={(e) =>
                                  handleChangec(
                                    e,
                                    'signatures',
                                    `signatures[${index}].name.fontColor`,
                                    index
                                  )
                                }
                              />
                            </HStack>
                          </Box>
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>

                    {/* POSITION */}
                    <Accordion allowMultiple>
                      <AccordionItem border="none">
                        <HStack width="100%" justify="space-between" spacing={2}>
                          <Input
                            name={`signatures[${index}].position.position`}
                            value={signature.position.position}
                            onChange={(e) =>
                              handleChange(e, 'signatures', index)
                            }
                            placeholder="Position"
                            flex="1"
                            minW={0}
                          />

                          <AccordionButton
                            height="32px"
                            width="32px"
                            flexShrink={0}
                            borderRadius="md"
                            _hover={{ bg: 'blue.50' }}
                          >
                            <EditIcon color="blue.500" boxSize="18px" />
                          </AccordionButton>
                        </HStack>

                        <AccordionPanel pt={2}>
                          <Box bg="gray.50" p={3} borderRadius="md">
                            <HStack spacing={6} align="flex-start">
                              <VStack align="start" spacing={3}>
                                <Select
                                  name={`signatures[${index}].position.fontSize`}
                                  value={signature.position.fontSize}
                                  onChange={(e) =>
                                    handleChange(e, 'signatures', index)
                                  }
                                  placeholder="Font Size"
                                >
                                  {fontsizeopt.map((item, key) => (
                                    <option key={key} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </Select>

                                <Select
                                  name={`signatures[${index}].position.fontFamily`}
                                  value={signature.position.fontFamily}
                                  onChange={(e) =>
                                    handleChange(e, 'signatures', index)
                                  }
                                  placeholder="Font Style"
                                >
                                  {fontStyleopt.map((item, key) => (
                                    <option key={key} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </Select>

                                <Input
                                  name={`signatures[${index}].position.fontColor`}
                                  value={signature.position.fontColor}
                                  onChange={(e) =>
                                    handleChange(e, 'signatures', index)
                                  }
                                  placeholder="Color"
                                />

                                <HStack spacing={4}>
                                  <Checkbox
                                    name={`signatures[${index}].position.bold`}
                                    isChecked={
                                      signature.position.bold === 'bold'
                                    }
                                    onChange={(e) =>
                                      handleChangeStyle(e, 'signatures', index)
                                    }
                                  >
                                    Bold
                                  </Checkbox>

                                  <Checkbox
                                    name={`signatures[${index}].position.italic`}
                                    isChecked={
                                      signature.position.italic === 'italic'
                                    }
                                    onChange={(e) =>
                                      handleChangeStyle(e, 'signatures', index)
                                    }
                                  >
                                    Italic
                                  </Checkbox>
                                </HStack>
                              </VStack>

                              <HexAlphaColorPicker
                                value={signature.position.fontColor}
                                onChange={(e) =>
                                  handleChangec(
                                    e,
                                    'signatures',
                                    `signatures[${index}].position.fontColor`,
                                    index
                                  )
                                }
                              />
                            </HStack>
                          </Box>
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>

                    {/* IMAGE UPLOAD */}
                    <Accordion allowMultiple>
                      <AccordionItem border="none">
                        <HStack width="100%" spacing={3} align="center">
                          {signature.url.url && (
                            <Box
                              boxSize="46px"
                              flexShrink={0}
                              borderWidth="1px"
                              borderColor="gray.200"
                              borderRadius="md"
                              bg="white"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              overflow="hidden"
                            >
                              <Image
                                src={signature.url.url}
                                alt="Signature"
                                maxH="40px"
                                maxW="40px"
                                objectFit="contain"
                              />
                            </Box>
                          )}

                          {/* Upload sits below the name and position, and takes
                              whatever width the panel currently has. */}
                          <Box
                            as="label"
                            htmlFor={`signatures-${index}`}
                            flex="1"
                            minW={0}
                            minHeight="46px"
                            border="2px dashed"
                            borderColor="purple.300"
                            borderRadius="8px"
                            color="purple.600"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            gap={2}
                            px={3}
                            cursor="pointer"
                            _hover={{ bg: 'purple.50', borderColor: 'purple.400' }}
                          >
                            <FaUpload style={{ height: 14, width: 14 }} />
                            <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                              {signature.url.url
                                ? 'Replace signature image'
                                : 'Upload signature image'}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              JPG or PNG
                            </Text>
                          </Box>

                          <input
                            id={`signatures-${index}`}
                            type="file"
                            accept="image/jpeg , image/png"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              handleFileChange(e, 'signatures', index);
                              toast({
                                title: 'Image uploaded',
                                status: 'success',
                                duration: 2000,
                                isClosable: true,
                              });
                            }}
                          />

                          <AccordionButton
                            height="32px"
                            width="32px"
                            flexShrink={0}
                            borderRadius="md"
                          >
                            <EditIcon color="blue.500" boxSize="18px" />
                          </AccordionButton>
                        </HStack>

                        <AccordionPanel pt={2}>
                          <Box bg="gray.50" p={3} borderRadius="md">
                            <HStack spacing={4} width="100%">
                              <Text flexShrink={0}>Size</Text>
                              <Input
                                type="number"
                                name={`signatures[${index}].url.size`}
                                value={signature.url.size}
                                onChange={(e) =>
                                  handleChange(e, 'signatures', index)
                                }
                                flex="1"
                                minW="70px"
                              />

                              <Input
                                type="hidden"
                                name={`signatures[${index}].url.url`}
                                value={signature.url.url || ''}
                                onChange={(e) =>
                                  handleChange(e, 'signatures', index)
                                }
                              />

                              <Button
                                type="button"
                                onClick={(e) =>
                                  bgremove(e, 'signatures', index)
                                }
                              >
                                Remove Background
                              </Button>
                            </HStack>
                          </Box>
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>

                    {/* Actions */}
                    <HStack justify="flex-end" spacing={2}>
                      {/* The last remaining row is emptied rather than removed,
                          so the form always has a signature to fill in. */}
                      <Tooltip
                        label={
                          formData.signatures.length > 1
                            ? 'Delete this signature'
                            : 'Clear this signature'
                        }
                        hasArrow
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="red"
                          leftIcon={<CloseIcon boxSize="10px" />}
                          onClick={() => handleDeleteSignature(index)}
                        >
                          {formData.signatures.length > 1 ? 'Delete' : 'Clear'}
                        </Button>
                      </Tooltip>

                      {index === formData.signatures.length - 1 && (
                        <Tooltip label="Add another signature" hasArrow>
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="green"
                            leftIcon={<AddIcon boxSize="10px" />}
                            onClick={() => addField('signatures')}
                          >
                            Add signature
                          </Button>
                        </Tooltip>
                      )}
                    </HStack>
                  </VStack>
                </Box>
              ))}
            </Box>

            {/* Verifible link */}
            <Box
              width="100%"
              className="tw-my-4 tw-flex tw-flex-row tw-gap-2 tw-px-2 tw-items-center tw-justify-between"
            >
              {/* Label */}
              <Text className="tw-font-bold tw-text-[16px]">
                QR code with verifiable link:
              </Text>

              {/* Select box */}
              {/* <Select
                name="verifiableLink"
                value={formData.verifiableLink}
                onChange={(e) => handleChange(e, 'verifiableLink', null)}
                height="42px"
                width="160px"
                borderRadius="8px"
                borderWidth="2px"
                borderColor="gray.300"
                className="tw-flex tw-items-center"
                _hover={{ borderColor: 'blue.400' }}
                _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
              >
                <option value={true}>Required</option>
                <option value={false}>Not Required</option>
              </Select> */}

              <Text
                fontSize="sm"
                fontWeight="500"
                color="gray.600"
                minW="90px"
                textAlign="right"
              >
                {formData.verifiableLink ? '(Required)' : '(Not Required)'}
              </Text>

              {/*Toggle Switch with default value true */}
              <Switch
                isChecked={formData.verifiableLink === true}
                onChange={(e) =>
                  handleChange(
                    { target: { value: e.target.checked } },
                    'verifiableLink',
                    null
                  )
                }
                size="md"
                sx={{
                  '--switch-track-width': '48px',
                  '--switch-track-height': '24px',
                  '--switch-thumb-size': '20px',

                  '.chakra-switch__track': {
                    bg: 'gray.200',
                    borderRadius: 'full',
                    transition: 'background-color 0.2s ease',
                    _checked: {
                      bg: 'teal.500',
                    },
                  },

                  '.chakra-switch__thumb': {
                    bg: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    transition: 'transform 0.2s ease',
                  },
                }}
              />

              <Input
                type="hidden"
                name="verifiableLink"
                value={formData.verifiableLink ? 'true' : 'false'}
                onChange={(e) => handleChange(e, 'verifiableLink', null)}
              />
            </Box>

            {/* QR placement — only sent once the QR has actually been moved,
                so certificates saved earlier keep the template's position. */}
            {formData.verifiableLink && isPlacedQr(formData.qr) && (
              <Box
                width="100%"
                className="tw-flex tw-flex-row tw-gap-2 tw-px-2 tw-items-center tw-justify-between"
              >
                <input
                  type="hidden"
                  name="qr.x"
                  value={Math.round(Number(formData.qr.x))}
                  readOnly
                />
                <input
                  type="hidden"
                  name="qr.y"
                  value={Math.round(Number(formData.qr.y))}
                  readOnly
                />
                <input
                  type="hidden"
                  name="qr.size"
                  value={Math.round(Number(formData.qr.size) || 100)}
                  readOnly
                />
                <Text fontSize="sm" color="teal.600">
                  QR position: {Math.round(Number(formData.qr.x))},{' '}
                  {Math.round(Number(formData.qr.y))} · size{' '}
                  {Math.round(Number(formData.qr.size) || 100)}px — drag it on the
                  preview
                </Text>
                <Button size="xs" variant="outline" onClick={resetQrPlacement}>
                  Snap back
                </Button>
              </Box>
            )}

            {/* Date of issue */}
            <Box
              width="100%"
              className="tw-my-2 tw-flex tw-flex-row tw-gap-2 tw-px-2 tw-items-center tw-justify-between"
            >
              <HStack width="100%">
                <Text className="tw-font-bold" width="40%">
                  Date of issue:
                </Text>
                <Input
                  type="date"
                  name="footer.footer"
                  width="180px"
                  borderWidth="2px"
                  value={formData.footer.footer}
                  onChange={(e) => handleChange(e, 'footer', null)}
                />
              </HStack>
            </Box>

            <Box width="100%" className="tw-px-2 tw-my-4">
              <Button
                type="submit"
                width="100%"
                height="44px"
                borderRadius="12px"
                colorScheme="blue"
                fontSize="md"
                fontWeight="semibold"
              >
                Save Changes
              </Button>
            </Box>
          </VStack>
        </Box>
      </Container>

      {/* Drag this to give the form more room and shrink the certificate. */}
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the form and certificate panels"
        aria-valuenow={Math.round(splitPct)}
        aria-valuemin={MIN_SPLIT}
        aria-valuemax={MAX_SPLIT}
        tabIndex={0}
        display={{ base: 'none', md: 'flex' }}
        alignItems="center"
        justifyContent="center"
        flex="0 0 12px"
        cursor="col-resize"
        bg={isDragging ? 'teal.50' : 'gray.50'}
        borderX="1px solid"
        borderColor="gray.200"
        _hover={{ bg: 'teal.50' }}
        _focusVisible={{ outline: '2px solid', outlineColor: 'teal.400' }}
        onPointerDown={handleSplitterDown}
        onDoubleClick={() => setSplit(DEFAULT_SPLIT)}
        onKeyDown={handleSplitterKeyDown}
        title="Drag to resize · double-click to reset"
      >
        <Box
          width="3px"
          height="42px"
          borderRadius="full"
          bg={isDragging ? 'teal.500' : 'gray.300'}
        />
      </Box>

      {/* The preview keeps a plain white ground whatever type is being edited,
          so the certificate is judged on its own colours. */}
      <Flex flex="1" minWidth={0} direction="column" bg="white" overflow="hidden">
        <Flex
          align="center"
          justify="space-between"
          px={4}
          py={2}
          borderBottom="1px solid"
          borderColor="gray.200"
          bg="white"
        >
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
              Certificate Preview
            </Text>
            {activeType && (
              <Box
                bg={activeType.tint}
                color={activeType.accent}
                borderWidth="1px"
                borderColor={activeType.accent}
                borderRadius="full"
                px={2}
                py="1px"
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
              >
                {activeType.label}
              </Box>
            )}
          </HStack>
          <HStack spacing={3}>
            <Text fontSize="xs" color="gray.500">
              {Math.round(previewScale * 100)}%
            </Text>
            <Text fontSize="xs" color="gray.500" display={{ base: 'none', lg: 'block' }}>
              Drag the logos, signatures and QR here to set their position and size
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSplit(DEFAULT_SPLIT)}
              isDisabled={!isWide}
            >
              Reset layout
            </Button>
          </HStack>
        </Flex>

        <Box flex="1" overflowY="auto" overflowX="hidden" px={0} py={2}>
          {isResolvingInitialType || isCertificateLoading ? (
            <Center width="100%" height="100%" minHeight="320px">
              <Text fontSize="lg" fontWeight="semibold" color="gray.600">
                Loading Certificate
              </Text>
            </Center>
          ) : formData.certiType ? (
            <ScaledCertificate onScaleChange={handlePreviewScale}>
              <SelectCertficate
                eventId={eventId}
                templateId={formData.templateId}
                contentBody={formData.body}
                certiType={formData.certiType}
                title={formData.title}
                certificateOf={formData.certificateOf}
                verifiableLink={formData.verifiableLink.toString()}
                logos={formData.logos}
                participantDetail={{}}
                signature={formData.signatures}
                header={formData.header}
                footer={formData.footer}
                qr={formData.qr}
                overlay={
                  <LogoPlacementLayer
                    logos={formData.logos}
                    scale={previewScale}
                    onLogoChange={updateLogoPlacement}
                    qr={formData.qr}
                    showQr={formData.verifiableLink === true}
                    onQrChange={updateQrPlacement}
                    signatures={formData.signatures}
                    onSignatureChange={updateSignaturePlacement}
                    onSignatureLineChange={updateSignatureLine}
                    onSignatureTextChange={updateSignatureText}
                  />
                }
              />
            </ScaledCertificate>
          ) : (
            <Center width="100%" height="100%" minHeight="320px">
              <Text fontSize="md" color="gray.600">
                No certificate configuration found for this event.
              </Text>
            </Center>
          )}
        </Box>
      </Flex>
    </Flex>
  );
};

export default CertificateForm;
