import React, { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Button, Box, Image, Text } from '@chakra-ui/react';
import { FaCamera } from 'react-icons/fa';

const NativeCamera = ({ onCapture }) => {
  const [photo, setPhoto] = useState(null);

  // Crucial: Hide completely on the web client to prevent merge conflicts/UI clutter
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const takePicture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });

      const imageUrl = `data:image/${image.format};base64,${image.base64String}`;
      setPhoto(imageUrl);
      
      if (onCapture) {
        onCapture({
          base64: image.base64String,
          format: image.format,
          dataUrl: imageUrl
        });
      }
    } catch (error) {
      console.error('Camera capture failed:', error);
    }
  };

  return (
    <Box my={4} p={4} borderWidth="1px" borderRadius="lg" bg="gray.50" _dark={{ bg: "gray.700" }}>
      <Text mb={3} fontSize="sm" fontWeight="bold" color="gray.600">
        Native Device Upload
      </Text>
      <Button 
        leftIcon={<FaCamera />} 
        colorScheme="blue" 
        onClick={takePicture}
        w="full"
      >
        Take a Picture
      </Button>
      {photo && (
        <Box mt={4}>
          <Text mb={2} fontSize="sm" color="green.500">Preview:</Text>
          <Image src={photo} alt="Captured Photo" borderRadius="md" objectFit="cover" maxH="200px" mx="auto" />
        </Box>
      )}
    </Box>
  );
};

export default NativeCamera;
