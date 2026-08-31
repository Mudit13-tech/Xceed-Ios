import React from 'react';
import PropTypes from 'prop-types';
import { Alert, AlertIcon, Box, Text } from '@chakra-ui/react';

/**
 * SafeChild - A resilient Error Boundary component for the Learning Module.
 *
 * Prevents isolated component rendering crashes (such as complex timetable grids or summaries)
 * from crashing the entire page or mobile app view.
 */
export default class SafeChild extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('SafeChild caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error)
          : this.props.fallback;
      }

      return (
        <Alert status="warning" borderRadius="md" my={2} fontSize="sm">
          <AlertIcon />
          <Box>
            <Text fontWeight="semibold">
              {this.props.title || 'Component could not be displayed'}
            </Text>
            <Text fontSize="xs" color="gray.600">
              {this.state.error?.message || 'An error occurred while rendering this section.'}
            </Text>
          </Box>
        </Alert>
      );
    }

    return this.props.children;
  }
}

SafeChild.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  title: PropTypes.string,
};
