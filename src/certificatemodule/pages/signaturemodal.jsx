import React, { useState, useEffect, useRef } from 'react'
import getEnvironment from '../../getenvironment';
import Modal from 'react-modal';
import { Text, IconButton, Input, HStack, Box, Button, Flex, Heading, SimpleGrid, Tooltip, useToast } from '@chakra-ui/react';
import { AddIcon, CloseIcon, CopyIcon } from '@chakra-ui/icons';
import { FaUpload } from "react-icons/fa";

const Signaturemodal = ({ eventId, formData, setFormData, index, handleFileChange, signatures, signature, handleChange, selectedFiles }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Uploaded');
    const [images, setImages] = useState([])
    const [search, setSearch] = useState('')
    const apiUrl = getEnvironment();
    const toast = useToast()

    useEffect(() => {
        const fetchdata = async () => {
            try {
                const response = await fetch(`${apiUrl}/certificatemodule/certificate/getcertificateimages/${eventId}`,
                    {
                        method: 'GET',
                        headers: {
                            "Content-type": "application/json"
                        },
                        credentials: 'include'
                    }
                )
                if (response.ok) {
                    const image = await response.json();
                    // console.log("image: ", image)
                    let Image = image.map((elem) => {
                        // console.log(elem)
                        if (elem["url"]["url"] || elem["url"]["url"] == "") {
                            return elem
                        } else if (elem["name"]["name"] || elem["name"]["name"] == "") {
                            const item = {
                                name: { name: elem.name.name, fontSize: elem.name.fontSize, fontFamily: elem.name.fontFamily, bold: elem.name.bold, italic: elem.name.italic, fontColor: elem.name.fontColor },
                                position: { position: elem.position.position, fontSize: elem.position.fontSize, fontFamily: elem.position.fontFamily, bold: elem.position.bold, italic: elem.position.italic, fontColor: elem.position.fontColor },
                                url: { url: elem.url || "", size: 100 }
                            }
                            return item;
                        } else if (elem["url"] || elem["url"] == "") {
                            const item = {
                                name: { name: elem.name, fontSize: "", fontFamily: "", bold: "normal", italic: "normal", fontColor: "black" },
                                position: { position: elem.position, fontSize: "", fontFamily: "", bold: "normal", italic: "normal", fontColor: "black" },
                                url: { url: elem.url, size: 100 }
                            }
                            return item;
                        } else {
                            const item = {
                                name: { name: " ", fontSize: "", fontFamily: "", bold: "normal", italic: "normal", fontColor: "black" },
                                position: { position: " ", fontSize: "", fontFamily: "", bold: "normal", italic: "normal", fontColor: "black" },
                                url: { url: "", size: 100 }
                            }
                            return item;
                        }
                    })
                    // Drop signature slots that were never given an image and
                    // keep one card per distinct address. The first entry used
                    // to be kept unconditionally, so a blank slot at the front
                    // rendered an <img> with no src -- the broken placeholder.
                    const seen = new Set();
                    const Images = Image.filter((elem) => {
                        const url = elem?.url?.url;
                        if (typeof url !== 'string' || !url.trim()) return false;
                        if (seen.has(url.trim())) return false;
                        seen.add(url.trim());
                        return true;
                    });
                    setImages(Images)
                } else {
                    console.error(response.error)
                }
            } catch (error) {
                console.error(error)
            }

        }
        fetchdata()
    }, [])

    function copyToClipboard(e, text) {
        e.stopPropagation();
        if (!navigator.clipboard) {
            return Promise.reject('Clipboard API not supported');
        }
        toast({
            title: 'Link copied',
            duration: 1000,
            isClosable: true,
        });
        return navigator.clipboard.writeText(text);
    }

    // Keeps the original index so a filtered click still applies the right one.
    const visibleImages = images
        .map((elem, i) => ({ ...elem, __index: i }))
        .filter((elem) => {
            const term = search.trim().toLowerCase();
            if (!term) return true;
            return (
                (elem?.name?.name || '').toLowerCase().includes(term) ||
                (elem?.position?.position || '').toLowerCase().includes(term)
            );
        });

    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);
    const handleTabClick = (tabId) => setActiveTab(tabId);
    // console.log(images)
    const handleClick = (e, i) => {
        const Signature = images[i]
        setFormData((prevData) => {
            const updatedField = [...prevData["signatures"]]
            updatedField[index] = Signature;
            return { ...prevData, signatures: updatedField }
        })
        setIsOpen(false)
    }
    return (
        <div>
            {/* The saved signatures are shown here directly instead of being
                hidden behind an upload icon — click one to use it. */}
            <HStack width="100%" justifyContent="space-between" mb={1}>
                <Text fontSize="sm" color="gray.600">Use an existing signature</Text>
                {images.length > 0 && (
                    <Button size="xs" variant="link" colorScheme="blue" onClick={openModal}>
                        View all ({images.length})
                    </Button>
                )}
            </HStack>

            {images.length === 0 ? (
                <Text fontSize="xs" color="gray.400" pb={1}>
                    No saved signatures yet — upload one below.
                </Text>
            ) : (
                <Box width="100%" overflowX="auto" pb={1}>
                    <HStack spacing={2} width="max-content">
                        {images.map((elem, i) => {
                            const isActive =
                                signature?.url?.url && signature.url.url === elem?.url?.url;
                            return (
                                <Box
                                    key={i}
                                    onClick={(e) => handleClick(e, i)}
                                    cursor="pointer"
                                    borderWidth="2px"
                                    borderColor={isActive ? 'blue.400' : 'gray.200'}
                                    borderRadius="md"
                                    bg="white"
                                    p={1}
                                    width="96px"
                                    flexShrink={0}
                                    _hover={{ borderColor: 'blue.300', bg: 'blue.50' }}
                                    title={elem?.name?.name || 'Signature'}
                                >
                                    <Box height="42px" display="flex" alignItems="center" justifyContent="center" overflow="hidden">
                                        <img
                                            src={elem?.url?.url || ''}
                                            alt={elem?.name?.name || 'Signature'}
                                            style={{ maxHeight: '40px', maxWidth: '84px', objectFit: 'contain' }}
                                        />
                                    </Box>
                                    <Text fontSize="10px" fontWeight="bold" color="black" noOfLines={1} textAlign="center">
                                        {elem?.name?.name}
                                    </Text>
                                    <Text fontSize="9px" color="gray.500" noOfLines={1} textAlign="center">
                                        {elem?.position?.position}
                                    </Text>
                                </Box>
                            );
                        })}
                    </HStack>
                </Box>
            )}
            <Modal
                className="tw-fixed tw-inset-0 tw-m-auto tw-w-[92vw] md:tw-w-[720px] tw-h-fit tw-max-h-[80vh] tw-outline-none"
                overlayClassName="tw-fixed tw-inset-0 tw-bg-black/50 tw-z-50 tw-flex"
                isOpen={isOpen}
                onRequestClose={closeModal}
                ariaHideApp={false}
            >
                <Box
                    bg="white"
                    borderRadius="2xl"
                    overflow="hidden"
                    boxShadow="2xl"
                    display="flex"
                    flexDirection="column"
                    maxHeight="80vh"
                >
                    {/* Header */}
                    <Flex
                        align="center"
                        justify="space-between"
                        px={5}
                        py={4}
                        bgGradient="linear(to-r, teal.600, blue.600)"
                        color="white"
                    >
                        <Box>
                            <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" opacity={0.85}>
                                Certificate Module
                            </Text>
                            <Heading size="md" mt={1}>Your Signatures</Heading>
                            <Text fontSize="sm" opacity={0.9} mt={1}>
                                Pick one to use its image, name and position on this certificate.
                            </Text>
                        </Box>
                        <IconButton
                            icon={<CloseIcon boxSize="12px" />}
                            aria-label="Close"
                            size="sm"
                            variant="ghost"
                            color="white"
                            _hover={{ bg: 'whiteAlpha.300' }}
                            onClick={closeModal}
                        />
                    </Flex>

                    {/* Search */}
                    <Box px={5} pt={4}>
                        <Input
                            placeholder="Search by name or position"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            size="sm"
                            borderRadius="md"
                        />
                    </Box>

                    {/* Grid */}
                    <Box px={5} py={4} overflowY="auto">
                        {visibleImages.length === 0 ? (
                            <Box py={10} textAlign="center" color="gray.500">
                                <Text fontWeight="medium">
                                    {images.length === 0
                                        ? 'You have no saved signatures yet'
                                        : 'No signature matches this search'}
                                </Text>
                                <Text fontSize="sm" mt={1}>
                                    {images.length === 0
                                        ? 'Signatures you upload on a certificate show up here.'
                                        : 'Try a different name or position.'}
                                </Text>
                            </Box>
                        ) : (
                            <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
                                {visibleImages.map((elem) => {
                                    const isActive =
                                        signature?.url?.url && signature.url.url === elem?.url?.url;
                                    return (
                                        <Box
                                            key={elem.__index}
                                            onClick={(e) => handleClick(e, elem.__index)}
                                            cursor="pointer"
                                            borderWidth="2px"
                                            borderColor={isActive ? 'blue.400' : 'gray.200'}
                                            borderRadius="lg"
                                            bg="white"
                                            p={3}
                                            position="relative"
                                            transition="all 0.15s ease"
                                            _hover={{ borderColor: 'blue.300', boxShadow: 'md' }}
                                        >
                                            <Tooltip label="Copy image link" hasArrow>
                                                <IconButton
                                                    icon={<CopyIcon />}
                                                    aria-label="Copy link"
                                                    size="xs"
                                                    variant="ghost"
                                                    position="absolute"
                                                    top="4px"
                                                    right="4px"
                                                    onClick={(e) => copyToClipboard(e, elem.url.url)}
                                                />
                                            </Tooltip>

                                            <Box
                                                height="86px"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                overflow="hidden"
                                                bg="gray.50"
                                                borderRadius="md"
                                            >
                                                <img
                                                    src={elem?.url?.url || ''}
                                                    alt={elem?.name?.name || 'Signature'}
                                                    style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                                                />
                                            </Box>

                                            <Text
                                                fontWeight="bold"
                                                color="black"
                                                fontSize="sm"
                                                textAlign="center"
                                                mt={2}
                                                noOfLines={1}
                                            >
                                                {elem?.name?.name}
                                            </Text>
                                            <Text
                                                fontSize="xs"
                                                color="gray.500"
                                                textAlign="center"
                                                noOfLines={1}
                                            >
                                                {elem?.position?.position}
                                            </Text>

                                            {isActive && (
                                                <Text
                                                    fontSize="10px"
                                                    fontWeight="bold"
                                                    color="blue.500"
                                                    textAlign="center"
                                                    mt={1}
                                                >
                                                    IN USE
                                                </Text>
                                            )}
                                        </Box>
                                    );
                                })}
                            </SimpleGrid>
                        )}
                    </Box>

                    {/* Footer */}
                    <Flex
                        px={5}
                        py={3}
                        borderTop="1px solid"
                        borderColor="gray.100"
                        justify="space-between"
                        align="center"
                    >
                        <Text fontSize="xs" color="gray.500">
                            {images.length} saved signature{images.length === 1 ? '' : 's'}
                        </Text>
                        <Button size="sm" onClick={closeModal}>
                            Close
                        </Button>
                    </Flex>
                </Box>
            </Modal>
        </div>
    )
}

export default Signaturemodal
