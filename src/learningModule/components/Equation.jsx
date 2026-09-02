import React, { useMemo } from 'react';
import katex from 'katex';
import { Box } from '@chakra-ui/react';
import 'katex/dist/katex.min.css';

/**
 * Renders a LaTeX string as typeset maths.
 *
 * Used by the tutorial editor to echo an answer formula back as a real
 * equation while the teacher types: "V/(R_1+R_2)" is easy to mistype and hard
 * to proofread as text, and obvious as a fraction. The LaTeX itself comes from
 * the server, which builds it from the same AST it will later evaluate — so
 * what is displayed here cannot disagree with what gets marked.
 *
 * Renders nothing at all when there is no LaTeX, which is the normal state
 * while a formula is still half-typed and does not parse.
 */
export default function Equation({ latex, fontSize = 'md', ...rest }) {
  const html = useMemo(() => {
    if (!latex) return null;
    try {
      return katex.renderToString(latex, { displayMode: false, throwOnError: false, output: 'html' });
    } catch {
      return null;
    }
  }, [latex]);

  if (!html) return null;

  return (
    <Box
      fontSize={fontSize}
      color="lmFg.body"
      w="100%"
      maxW="100%"
      // Full width, so a normal equation has all the room it needs and no
      // scrollbar appears. `auto` still rescues a genuinely enormous one
      // rather than letting it push the layout sideways.
      sx={{ '.katex': { fontSize: '1.05em', whiteSpace: 'normal' }, overflowX: 'auto', py: 1 }}
      // Safe: the markup is KaTeX's own output, built from a LaTeX string this
      // app generated from a parsed formula — no author-supplied HTML reaches it.
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
}
