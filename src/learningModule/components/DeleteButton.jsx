/**
 * The module's one delete control: a red trash icon, never the word "Delete"
 * or a ✕. A cross reads as "close", and a row of text buttons ending in
 * "Delete" puts the destructive action on the same footing as the rest.
 *
 * `label` names what goes — "Delete quiz", "Remove option" — and is both the
 * accessible name and the hover hint, since the button carries no text.
 */
import React, { forwardRef } from 'react';
import { IconButton } from '@chakra-ui/react';
import { LmIcon } from './Icon';

const ICON_SIZE = { xs: 13, sm: 15, md: 17, lg: 19 };

const DeleteButton = forwardRef(function DeleteButton({ label = 'Delete', size = 'sm', ...rest }, ref) {
  return (
    <IconButton
      ref={ref}
      size={size}
      variant="ghost"
      colorScheme="red"
      aria-label={label}
      title={label}
      icon={<LmIcon name="delete" size={ICON_SIZE[size] || 15} />}
      {...rest}
    />
  );
});

export default DeleteButton;
