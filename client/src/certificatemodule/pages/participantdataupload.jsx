import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import getEnvironment from '../../getenvironment';
import FileDownloadButton from '../../filedownload/filedownload';
import { Link as ChakraLink } from '@chakra-ui/react';
import { useToast } from '@chakra-ui/react';
import { IconButton } from '@chakra-ui/react';
import { FiEdit2, FiMail, FiTrash2 } from 'react-icons/fi';
import { FiCheck } from 'react-icons/fi';
import { FiDownload } from 'react-icons/fi';
import { FiAlertTriangle, FiFileText, FiX } from 'react-icons/fi';
import { Tooltip } from '@chakra-ui/react';

import saveAs from 'file-saver';

// import subjectFile from '../assets/subject_template';
import {
  Container,
  Flex,
  Heading,
  Progress,
  Input,
  Box,
  FormLabel,
  FormControl,
  Select,
  UnorderedList,
  Text,
  Center,
  HStack,
  VStack,
  Badge,
  Spinner,
  List,
  ListItem,
} from '@chakra-ui/react';
import {
  CustomTh,
  CustomLink,
  CustomBlueButton,
  CustomDeleteButton,
  CustomTealButton,
} from '../../styles/customStyles';

import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { Button } from '@chakra-ui/react';
import Header from '../../components/header';
import { FaUpload } from 'react-icons/fa';

// Column names as they appear in public/participant_template.xlsx. The upload
// route stores each sheet row as-is, so these are also the participant fields
// that survive a batch upload.
const REQUIRED_COLUMNS = ['name', 'mailId', 'certiType'];
const OPTIONAL_COLUMNS = [
  'department',
  'college',
  'types',
  'teamName',
  'position',
  'title1',
  'title2',
];
const KNOWN_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
const CERTIFICATE_TYPES = ['winner', 'participant', 'speaker', 'organizer'];

const cell = (value) => String(value ?? '').trim();

// The upload route accepts whatever the sheet contains, so a malformed file is
// only discovered once its rows are already in the database. Parsing the file
// here first lets the user see what will be sent -- and what is missing --
// before committing to the upload.
const buildPreview = (rows) => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !columns.includes(column)
  );
  // Unknown columns are not fatal: they are saved but ignored by the
  // certificate templates, which is worth pointing out before the upload.
  const unknownColumns = columns.filter(
    (column) => !KNOWN_COLUMNS.includes(column)
  );

  const invalidRows = [];
  rows.forEach((row, index) => {
    const problems = [];

    REQUIRED_COLUMNS.forEach((column) => {
      if (!cell(row[column])) {
        problems.push(`${column} is empty`);
      }
    });

    const mailId = cell(row.mailId);
    if (mailId && !/^\S+@\S+\.\S+$/.test(mailId)) {
      problems.push(`"${mailId}" is not a valid email address`);
    }

    const certiType = cell(row.certiType).toLowerCase();
    if (certiType && !CERTIFICATE_TYPES.includes(certiType)) {
      problems.push(
        `certiType "${cell(row.certiType)}" is not one of ${CERTIFICATE_TYPES.join(', ')}`
      );
    }

    if (problems.length > 0) {
      // +2 so the number matches the spreadsheet: one for the header row, one
      // because sheet rows are numbered from 1.
      invalidRows.push({ rowNumber: index + 2, problems });
    }
  });

  // A duplicated address usually means the same person was pasted in twice; the
  // server does not check, so a certificate would be mailed to them twice over.
  const seen = new Set();
  const duplicateMails = new Set();
  rows.forEach((row) => {
    const mailId = cell(row.mailId).toLowerCase();
    if (!mailId) return;
    if (seen.has(mailId)) duplicateMails.add(mailId);
    seen.add(mailId);
  });

  return {
    rows,
    columns,
    missingColumns,
    unknownColumns,
    invalidRows,
    duplicateMails: [...duplicateMails],
  };
};

function Participant() {
  const currentURL = window.location.pathname;
  const parts = currentURL.split('/');
  const eventId = parts[parts.length - 2];
  const frontendHost = parts[parts.length - 4];
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadState, setUploadState] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [tableData, setTableData] = useState([]);
  const [editRowId, setEditRowId] = useState(null);
  const [semesterData, setSemesterData] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [duplicateEntryMessage, setDuplicateEntryMessage] = useState('');
  const [addduplicateEntryMessage, addsetDuplicateEntryMessage] = useState('');
  const [isAddSubjectFormVisible, setIsAddSubjectFormVisible] = useState(false);
  const [downloadClicked, setDownloadClicked] = useState(false);

  const [editedData, setEditedData] = useState({
    name: '',
    department: '',
    college: '',
    types: '',
    teamName: '',
    position: '',
    title1: '',
    title2: '',
    certiType: '',
    mailId: '',
    eventId: eventId,
    isCertificateSent: false,
  });

  const [editedSData, setEditedSData] = useState({
    name: '',
    department: '',
    college: '',
    types: '',
    teamName: '',
    position: '',
    title1: '',
    title2: '',
    certiType: '',
    mailId: '',
    eventId: eventId,
    isCertificateSent: false,
  });

  const [downloadType, setDownloadType] = useState(false);
  // Batch mail runs one participant at a time so the page can report where it
  // has got to; the server's own bulk route returns only once everything is
  // finished, which looks like nothing is happening.
  const [mailProgress, setMailProgress] = useState({
    running: false,
    total: 0,
    done: 0,
    current: '',
    failed: [],
  });
  const [isSavingNew, setIsSavingNew] = useState(false);

  const apiUrl = getEnvironment();
  const toast = useToast();

  useEffect(() => {
    fetchParticipantData();
  }, [eventId]);

  const fetchParticipantData = () => {
    if (eventId) {
      setIsLoading(true);
      fetch(
        `${apiUrl}/certificatemodule/participant/getparticipant/${eventId}`,
        {
          credentials: 'include',
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Error: ${response.status} - ${response.statusText}`
            );
          }
          return response.json();
        })
        .then((data) => {
          //   const filteredData = data.filter((item) => item.code === currentCode);
          setTableData(data);
        })
        .catch((error) => {
          console.error('Error:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setTableData([]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadError('');
    // Without this the same file cannot be picked twice in a row, because the
    // input fires no change event when its value is unchanged.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    clearSelectedFile();
    setUploadMessage('');
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setUploadError(
        'Unsupported file type. Upload an Excel file (.xlsx) built from the template.'
      );
      return;
    }

    setSelectedFile(file);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      // The upload route walks every sheet in the workbook, so the preview has
      // to as well or it would under-report what is about to be saved.
      const rows = workbook.SheetNames.flatMap((sheetName) =>
        XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
      );

      if (rows.length === 0) {
        setUploadError('This file has no data rows below the header.');
        return;
      }
      setFilePreview(buildPreview(rows));
    } catch (error) {
      console.error('Error reading file:', error);
      setUploadError(
        'Could not read this file. Make sure it is a valid Excel workbook.'
      );
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Choose an Excel file before uploading.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    // Missing required columns are blocked rather than warned about: every row
    // would land without a name or an email, leaving unusable records behind.
    if (filePreview?.missingColumns.length) {
      toast({
        title: 'Required columns missing',
        description: `Add ${filePreview.missingColumns.join(', ')} to the sheet, then upload again.`,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
      return;
    }

    const rowCount = filePreview?.rows.length ?? 0;
    setIsUploading(true);
    setUploadError('');
    setUploadMessage('');

    const formData = new FormData();
    formData.append('csvFile', selectedFile);
    formData.append('eventId', eventId);

    fetch(`${apiUrl}/upload/participant`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
      .then(async (response) => {
        // The shared upload route answers with plain text on success and JSON
        // only when it has something to report, so read the body as text and
        // then try to make sense of it as JSON.
        const body = await response.text();
        if (!response.ok) {
          throw new Error(
            body || `Error: ${response.status} - ${response.statusText}`
          );
        }
        try {
          return JSON.parse(body);
        } catch {
          return {};
        }
      })
      .then((data) => {
        clearSelectedFile();
        fetchParticipantData();
        const description =
          data?.message ||
          `${rowCount} participant${rowCount === 1 ? '' : 's'} added to this event.`;
        setUploadMessage(description);
        toast({
          title: 'Upload successful',
          description,
          status: 'success',
          duration: 4000,
          isClosable: true,
        });
      })
      .catch((error) => {
        console.error('Error:', error);
        setUploadError(error.message || 'Upload failed. Please try again.');
        toast({
          title: 'Upload failed',
          description: error.message || 'Participant data could not be uploaded.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  // const handleUpload = () => {
  //   if (selectedFile) {
  //     const formData = new FormData();
  //     formData.append('csvFile', selectedFile);
  //     formData.append('eventcode', eventId);
  //     setIsLoading(true);

  //     fetch(`${apiUrl}/certificatemodule/participant/batchupload/${eventId}`, {
  //       method: 'POST',
  //       body: formData,
  //       credentials: 'include',
  //     })
  //       .then((response) => {
  //         if (!response.ok) {
  //           throw new Error(`Error: ${response.status} - ${response.statusText}`);
  //         }
  //         setUploadState(true);
  //         setUploadMessage('File uploaded successfully');
  //         return response.json();
  //       })
  //       .then((data) => {
  //         if (data.message) {
  //           setDuplicateEntryMessage(data.message);

  //         } else {
  //           fetchParticipantData();
  //           setDuplicateEntryMessage('');
  //         }
  //         setIsLoading(false);
  //       })
  //       .catch((error) => {
  //         console.error('Error:', error);
  //         setIsLoading(false);
  //       })
  //       .finally(() => {
  //         setIsLoading(false);
  //         setTimeout(() => {
  //           setUploadMessage('');
  //         }, 3000);
  //       });
  //   } else {
  //     alert('Please select a CSV file before uploading.');
  //   }
  // };

  useEffect(() => {
    fetchParticipantData();
    if (uploadState) {
      setUploadState(false);
    }
  }, [eventId, uploadState]);

  const handleEditClick = (_id) => {
    setEditRowId(_id);
    const editedRow = tableData.find((row) => row._id === _id);
    if (editedRow) {
      setEditedData({ ...editedRow });
    }
  };

  const handleSaveEdit = () => {
    if (editRowId) {
      const rowIndex = tableData.findIndex((row) => row._id === editRowId);
      if (rowIndex !== -1) {
        const updatedData = [...tableData];
        updatedData[rowIndex] = editedData;
        if (!editedData.name.trim()) {
          alert('Name is required');
          return;
        }
        if (!editedData.certiType.trim()) {
          alert('Certificate type is required');
          return;
        }
        if (!editedData.mailId.trim()) {
          alert('E-mail is required');
          return;
        }

        fetch(
          `${apiUrl}/certificatemodule/participant/addparticipant/${editRowId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(editedData),
            credentials: 'include',
          }
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `Error: ${response.status} - ${response.statusText}`
              );
            }
            return response.json();
          })
          .then((data) => {
            // console.log("Update Success:", data);

            setTableData(updatedData);
            setEditRowId(null);
            setEditedData({
              _id: null,

              name: '',
              department: '',
              college: '',
              types: '',
              position: '',
              teamName: '',
              title1: '',
              title2: '',
              certiType: '',
              mailId: '',
              eventId: eventId,
              isCertificateSent: false,
            });
          })
          .catch((error) => {
            console.error('Update Error:', error);
          });
      }
    }
  };

  const handleMailstatus = (RowId) => {
    let data = {};
    if (RowId) {
      console.log(RowId);
      const rowIndex = tableData.findIndex((row) => row._id === RowId);
      console.log(rowIndex);

      if (rowIndex !== -1) {
        data.isCertificateSent = true;
        console.log('data to be sent', editedData);
        fetch(
          `${apiUrl}/certificatemodule/participant/addparticipant/${RowId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },

            body: JSON.stringify(data),
            credentials: 'include',
          }
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `Error: ${response.status} - ${response.statusText}`
              );
            }
            return response.json();
          })
          .then((data) => {
            console.log('Update Success:', data);
            fetchParticipantData();

            // setTableData(updatedData);
            // setEditRowId(null);
            // setEditedData({
            //   _id: null,

            //   name: "",
            //   department: "",
            //   college: "",
            //   types: "",
            //   position: "",
            //   title1: "",
            //   title2: "",
            //   certiType: "",
            //   mailId: "",
            //   eventId: eventId,
            //   isCertificateSent:false,
            // });
          })
          .catch((error) => {
            console.error('Update Error:', error);
          });
      }
    }
  };

  const markCertificateSent = async (participantId) => {
    const response = await fetch(
      `${apiUrl}/certificatemodule/participant/addparticipant/${participantId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCertificateSent: true }),
        credentials: 'include',
      }
    );
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }
  };

  const handleBatchMail = async () => {
    const pending = tableData.filter((row) => !row.isCertificateSent);

    if (pending.length === 0) {
      toast({
        title: 'Nothing to send',
        description: 'Every participant has already received their certificate.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const confirmed = window.confirm(
      `Send certificates to ${pending.length} participant${
        pending.length === 1 ? '' : 's'
      }?`
    );
    if (!confirmed) return;

    setMailProgress({
      running: true,
      total: pending.length,
      done: 0,
      current: '',
      failed: [],
    });

    const failed = [];

    for (let i = 0; i < pending.length; i += 1) {
      const participant = pending[i];
      const label = participant.mailId || participant.name || 'participant';

      setMailProgress((prev) => ({ ...prev, done: i, current: label }));

      try {
        const response = await fetch(
          `${apiUrl}/certificatemodule/emails/send-email/${participant._id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }
        );
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        await markCertificateSent(participant._id);
      } catch (error) {
        console.error('Error sending mail to', label, error);
        failed.push(label);
      }
    }

    setMailProgress({
      running: false,
      total: pending.length,
      done: pending.length,
      current: '',
      failed,
    });

    fetchParticipantData();

    toast({
      title: failed.length
        ? `Sent ${pending.length - failed.length} of ${pending.length}`
        : 'All certificates sent',
      description: failed.length
        ? `${failed.length} could not be sent — see the list above the table.`
        : `${pending.length} email${pending.length === 1 ? '' : 's'} sent.`,
      status: failed.length ? 'warning' : 'success',
      duration: 5000,
      isClosable: true,
    });
  };

  const handleMailClick = (Id) => {
    // Make the fetch request
    fetch(`${apiUrl}/certificatemodule/emails/send-email/${Id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Frontend-Host': window.location.origin,
      },
      // body: JSON.stringify(requestData),
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        // Handle the response from the backend, if needed
        console.log('Mail sent successfully:', data);
        toast({
          title: 'Mail sent',
          description: 'Email has been sent successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          // position:'middle',
        });
        handleMailstatus(Id);
      })
      .catch((error) => {
        console.error('Error sending mail:', error);
      });
  };

  const handleDelete = (_id) => {
    const isConfirmed = window.confirm(
      'Are you sure you want to delete this entry?'
    );

    if (isConfirmed) {
      fetch(
        `${apiUrl}/certificatemodule/participant/deleteparticipant/${_id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Error: ${response.status} - ${response.statusText}`
            );
          }
          return response.json();
        })
        .then((data) => {
          // console.log("Delete Success:", data);
          const updatedData = tableData.filter((row) => row._id !== _id);
          setTableData(updatedData);
        })
        .catch((error) => {
          console.error('Delete Error:', error);
        });
    }
  };

  const handleCancelAddSubject = () => {
    setIsAddSubjectFormVisible(false);
  };

  const handleAddSubject = () => {
    setEditedSData({
      name: '',
      department: '',
      college: '',
      types: '',
      position: '',
      teamName: '',
      title1: '',
      title2: '',
      certiType: '',
      mailId: '',
      eventId: eventId,
      isCertificateSent: false,
    });
    setIsAddSubjectFormVisible(true);
  };

  const handleSaveNewSubject = () => {
    // const isDuplicateEntry = tableData.some(
    //   (row) => row.name === editedSData.name
    // );

    // if (isDuplicateEntry) {
    //   addsetDuplicateEntryMessage(
    //     `Duplicate entry for "${editedSData.name}" is detected. Kindly delete the entry.`
    //   );
    // } else {
    // Toasts rather than alert(): a blocking dialog freezes the whole tab.
    const missing = !editedSData.name.trim()
      ? 'Name'
      : !editedSData.certiType.trim()
        ? 'Certificate type'
        : !editedSData.mailId.trim()
          ? 'E-mail'
          : null;
    if (missing) {
      toast({
        title: `${missing} is required`,
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (isSavingNew) return;
    setIsSavingNew(true);
    fetch(`${apiUrl}/certificatemodule/participant/addparticipant/${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(editedSData),
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Data saved successfully:', data);
        toast({
          title: 'Data Saved ',
          description: 'Updated successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
          // position:'middle',
        });
        fetchParticipantData();
        handleCancelAddSubject();
        addsetDuplicateEntryMessage('');
        // Leaving the old values behind made the form look stuck the next time
        // it was opened.
        setEditedSData({
          name: '',
          department: '',
          college: '',
          types: '',
          teamName: '',
          position: '',
          title1: '',
          title2: '',
          certiType: '',
          mailId: '',
          eventId: eventId,
          isCertificateSent: false,
        });
      })
      .catch((error) => {
        console.error('Error:', error);
        toast({
          title: 'Could not save the participant',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      })
      .finally(() => {
        setIsSavingNew(false);
      });
    // }
  };

  // const handleDeleteAll = () => {
  //   if (eventId) {
  //     if (
  //       window.confirm(
  //         "Are you sure you want to delete all entries with the current code?"
  //       )
  //     ) {
  //       fetch(`${apiUrl}/certificatemodule/participant/deleteall/${eventId}`, {
  //         method: "DELETE",
  //         credentials: "include",
  //       })
  //         .then((response) => {
  //           if (!response.ok) {
  //             throw new Error(
  //               `Error: ${response.status} - ${response.statusText}`
  //             );
  //           }
  //           return response.json();
  //         })
  //         .then((data) => {
  //           // console.log("Delete All Success:", data);
  //           fetchParticipantData();
  //         })
  //         .catch((error) => {
  //           console.error("Delete All Error:", error);
  //         });
  //     }
  //   }
  // };

  // const handleChangeType = async (e) => setDownloadType(e.target.value);
  // const handleDownloadAll = async (e) => {
  //   if (!downloadType) { alert("choose a download type first"); return; }
  //   if (downloadClicked) {
  //     const clicked = confirm("Do you want to download again");
  //     if (!clicked) { return; }
  //   }
  //   try {
  //     const response = await fetch(
  //       `${apiUrl}/certificatemodule/certificate/downloadall`,
  //       {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json'
  //         },

  //         credentials: 'include',
  //         body: JSON.stringify({ eventID: eventId, type: downloadType }),
  //       }
  //     );
  //     const zipBlob = await response.blob();
  //     console.log(zipBlob)
  //     saveAs(zipBlob, "certificates.zip", "application/zip")
  //   } catch (error) {
  //     console.error('Error converting SVGs:', error);
  //   }
  // }
  return (
    <Container maxW="8xl">
      {/* Header card, matching the certificate design and dashboard pages. */}
      <Box
        mt={4}
        mb={5}
        px={{ base: 5, md: 8 }}
        py={{ base: 5, md: 6 }}
        borderRadius="2xl"
        bgGradient="linear(to-r, teal.600, blue.600)"
        color="white"
        boxShadow="lg"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ md: 'center' }}
          justify="space-between"
          gap={4}
        >
          <Box>
            <Text
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="widest"
              opacity={0.85}
            >
              Certificate Module
            </Text>
            <Heading size="lg" mt={1}>
              Participants
            </Heading>
            <Text mt={2} fontSize="sm" opacity={0.9}>
              Add people one at a time or upload a sheet — each row needs a name,
              an email, and the certificate type they should receive.
            </Text>
          </Box>

          <HStack spacing={3} flexShrink={0}>
            <Box
              bg="whiteAlpha.300"
              borderRadius="lg"
              px={4}
              py={2}
              textAlign="center"
              minW="96px"
            >
              <Text fontSize="2xl" fontWeight="bold" lineHeight={1}>
                {tableData.length}
              </Text>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide">
                Added
              </Text>
            </Box>
            <Button
              size="sm"
              bg="white"
              color="teal.700"
              _hover={{ bg: 'gray.100' }}
              as="a"
              href="/cm/dashboard"
            >
              Back to events
            </Button>
          </HStack>
        </Flex>
      </Box>

      <Box
        p="3"
        display={'flex'}
        flexDirection={'column'}
        gap="6"
        bg="gray.50"
        borderRadius="md"
        justifyItems={'start'}
        border={'1px'}
        boxShadow={'md'}
        borderColor={'gray.200'}
      >
        {/* add new participant form or Batch Upload (both grouped together in a BOX)*/}
        <Box
          bg="white"
          p={{ base: 3, md: 6 }}
          borderRadius="lg"
          boxShadow="md"
          display="flex"
          flexDirection="column"
          gap={4}
        >
          <Box display={'flex'} flexDirection={{base:'column',md:'row'}} gap={2} >
            <Box
              display="flex"
              alignItems={{ base: 'flex-start', md: 'center' }}
              gap="4"
              flexWrap="wrap"
              flexDirection={{ base: 'column', md: 'row' }}
            >
              <h1 className="tw-text-[18px] tw-font-medium">Batch Upload:</h1>

              <Box
                display="flex"
                alignItems="center"
                gap="3"
                border="1px solid"
                borderColor="gray.300"
                borderRadius="md"
                px="3"
                py="2"
                bg="white"
                width={{ base: '100%', md: 'auto' }}
                flexWrap="wrap"
              >
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  name="XlsxFile"
                  variant="unstyled"
                  width={{ base: '100%', md: '260px' }}
                  cursor="pointer"
                  isDisabled={isUploading}
                  sx={{
                    '::file-selector-button': {
                      border: 'none',
                      bg: 'purple.50',
                      color: 'purple.600',
                      px: '3',
                      py: '1',
                      mr: '3',
                      borderRadius: 'md',
                      cursor: 'pointer',
                      fontWeight: '500',
                    },
                    '::file-selector-button:hover': {
                      bg: 'purple.100',
                    },
                  }}
                />

                <Tooltip
                  label={
                    selectedFile
                      ? 'Upload the selected file'
                      : 'Choose an Excel file first'
                  }
                  hasArrow
                  placement="bottom"
                >
                  <Box
                    as={CustomTealButton}
                    onClick={handleUpload}
                    aria-label="Upload participant file"
                    p="8px"
                    borderRadius="md"
                    cursor={
                      selectedFile && !isUploading ? 'pointer' : 'not-allowed'
                    }
                    bgColor="purple.500"
                    opacity={selectedFile && !isUploading ? 1 : 0.5}
                    pointerEvents={isUploading ? 'none' : 'auto'}
                    _hover={{ bg: 'purple.700' }}
                    flexShrink={0}
                  >
                    {isUploading ? (
                      <Spinner size="sm" color="white" />
                    ) : (
                      <FaUpload
                        style={{ height: 18, width: 18, color: 'white' }}
                      />
                    )}
                  </Box>
                </Tooltip>
              </Box>

              {uploadMessage && (
                <Box fontSize="sm" color="green.600" fontWeight="medium">
                  {uploadMessage}
                </Box>
              )}
            </Box>

            <Tooltip
              label="Download participants Excel template"
              hasArrow
              placement="bottom"
            >
              <IconButton
                aria-label="Download participant template"
                icon={<FiDownload />}
                variant="ghost"
                size="lg"
                onClick={() =>
                  window.open('/participant_template.xlsx', '_blank')
                }
              />
            </Tooltip>
          </Box>

          {/* What the chosen file actually contains, checked against the
              template before anything is sent to the server. */}
          {uploadError && (
            <Box
              bg="red.50"
              borderWidth="1px"
              borderColor="red.200"
              borderRadius="md"
              px="4"
              py="3"
              fontSize="sm"
              color="red.700"
            >
              {uploadError}
            </Box>
          )}

          {filePreview && (
            <Box
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="md"
              bg="gray.50"
              px="4"
              py="3"
            >
              <VStack align="stretch" spacing="3">
                <HStack justify="space-between" flexWrap="wrap" gap="2">
                  <HStack spacing="2">
                    <FiFileText />
                    <Text fontWeight="medium" fontSize="sm">
                      {selectedFile?.name}
                    </Text>
                    <Badge colorScheme="purple">
                      {filePreview.rows.length} row
                      {filePreview.rows.length === 1 ? '' : 's'}
                    </Badge>
                    {filePreview.invalidRows.length > 0 && (
                      <Badge colorScheme="orange">
                        {filePreview.invalidRows.length} need
                        {filePreview.invalidRows.length === 1 ? 's' : ''}{' '}
                        attention
                      </Badge>
                    )}
                  </HStack>

                  <IconButton
                    aria-label="Clear selected file"
                    icon={<FiX />}
                    size="xs"
                    variant="ghost"
                    onClick={clearSelectedFile}
                    isDisabled={isUploading}
                  />
                </HStack>

                {filePreview.missingColumns.length > 0 && (
                  <HStack align="flex-start" spacing="2" color="red.600">
                    <Box pt="1">
                      <FiAlertTriangle />
                    </Box>
                    <Text fontSize="sm">
                      Required column
                      {filePreview.missingColumns.length === 1 ? '' : 's'}{' '}
                      <b>{filePreview.missingColumns.join(', ')}</b> not found in
                      the sheet. Upload is blocked until they are added.
                    </Text>
                  </HStack>
                )}

                {filePreview.unknownColumns.length > 0 && (
                  <Text fontSize="sm" color="gray.600">
                    Column{filePreview.unknownColumns.length === 1 ? '' : 's'}{' '}
                    <b>{filePreview.unknownColumns.join(', ')}</b> are not used
                    by the certificate templates and will be ignored.
                  </Text>
                )}

                {filePreview.duplicateMails.length > 0 && (
                  <Text fontSize="sm" color="orange.600">
                    Repeated email address
                    {filePreview.duplicateMails.length === 1 ? '' : 'es'}:{' '}
                    <b>{filePreview.duplicateMails.join(', ')}</b>. Each copy
                    gets its own certificate.
                  </Text>
                )}

                {filePreview.invalidRows.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" color="orange.700">
                      Rows with problems:
                    </Text>
                    <List fontSize="sm" color="gray.700" mt="1" spacing="1">
                      {filePreview.invalidRows.slice(0, 5).map((row) => (
                        <ListItem key={row.rowNumber}>
                          Row {row.rowNumber}: {row.problems.join('; ')}
                        </ListItem>
                      ))}
                    </List>
                    {filePreview.invalidRows.length > 5 && (
                      <Text fontSize="sm" color="gray.500" mt="1">
                        ...and {filePreview.invalidRows.length - 5} more.
                      </Text>
                    )}
                  </Box>
                )}

                {filePreview.missingColumns.length === 0 &&
                  filePreview.invalidRows.length === 0 && (
                    <Text fontSize="sm" color="green.600">
                      Every row has a name, a valid email and a known
                      certificate type. Ready to upload.
                    </Text>
                  )}
              </VStack>
            </Box>
          )}

          {/* Header + Batch Upload */}

          {/* Form / Manual Add */}
          <Box>
            {isAddSubjectFormVisible ? (
              <FormControl>
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: '1fr', md: '1fr 1fr' }}
                  gap={{ base: 4, md: 5 }}
                >
                  <Box>
                    <FormLabel>Name</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Name of the participant"
                      value={editedSData.name}
                      onChange={(e) =>
                        setEditedSData({ ...editedSData, name: e.target.value })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Department</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Name of the department"
                      value={editedSData.department}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          department: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>College</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Name of the college"
                      value={editedSData.college}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          college: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Type</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Type of the event"
                      value={editedSData.types}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          types: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Team Name</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Team Name"
                      value={editedSData.teamName}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          teamName: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Position</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Position"
                      value={editedSData.position}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          position: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Title-1</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Title 1"
                      value={editedSData.title1}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          title1: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Title-2</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Title 2"
                      value={editedSData.title2}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          title2: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Email</FormLabel>
                    <Input
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Mail"
                      value={editedSData.mailId}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          mailId: e.target.value,
                        })
                      }
                    />
                  </Box>

                  <Box>
                    <FormLabel>Certificate Type</FormLabel>
                    <Select
                      border="1px"
                      borderColor="gray.300"
                      placeholder="Select Certificate Type"
                      value={editedSData.certiType}
                      onChange={(e) =>
                        setEditedSData({
                          ...editedSData,
                          certiType: e.target.value,
                        })
                      }
                    >
                      <option value="winner">Winner</option>
                      <option value="participant">Participant</option>
                      <option value="speaker">Speaker</option>
                      <option value="organizer">Organizer</option>
                    </Select>
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box
                  mt={8}
                  display="flex"
                  flexDirection={{ base: 'column', md: 'row' }}
                  justifyContent="flex-end"
                  gap={{ base: 1, md: 4 }}
                >
                  <CustomBlueButton
                    variant="outline"
                    border="1px solid"
                    borderColor="gray.300"
                    color="gray.700"
                    bg="white"
                    boxShadow="sm"
                    _hover={{
                      bg: 'gray.50',
                      borderColor: 'gray.400',
                      boxShadow: 'md',
                    }}
                    onClick={handleCancelAddSubject}
                  >
                    Cancel
                  </CustomBlueButton>

                  <CustomBlueButton
                    bg="blue.500"
                    color="white"
                    boxShadow="md"
                    _hover={{ bg: 'blue.600', boxShadow: 'lg' }}
                    onClick={handleSaveNewSubject}
                    isDisabled={isSavingNew}
                  >
                    {isSavingNew ? 'Saving…' : 'Save New Participant Data'}
                  </CustomBlueButton>
                </Box>
              </FormControl>
            ) : (
              <CustomTealButton
                bg="teal.600"
                color="white"
                px={6}
                py={2.5}
                fontSize="sm"
                fontWeight="medium"
                borderRadius="md"
                boxShadow="sm"
                width={{ base: '100%', md: 'auto' }}
                _hover={{ bg: 'teal.700' }}
                _active={{ bg: 'teal.800' }}
                onClick={handleAddSubject}
              >
                + Add Participant Manually
              </CustomTealButton>
            )}
          </Box>
        </Box>

        {addduplicateEntryMessage && <p>{addduplicateEntryMessage}</p>}

        {/* How far the batch send has got, and what failed. */}
        {mailProgress.total > 0 &&
          (mailProgress.running || mailProgress.failed.length > 0) && (
            <Box
              bg="white"
              borderWidth="1px"
              borderColor={mailProgress.running ? 'blue.200' : 'orange.200'}
              borderRadius="lg"
              p={4}
            >
              <Flex justify="space-between" align="center" gap={3} wrap="wrap">
                <Text fontWeight="semibold">
                  {mailProgress.running
                    ? `Sending certificates — ${mailProgress.done} of ${mailProgress.total}`
                    : `Finished — ${
                        mailProgress.total - mailProgress.failed.length
                      } of ${mailProgress.total} sent`}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {Math.round((mailProgress.done / mailProgress.total) * 100)}%
                </Text>
              </Flex>

              <Progress
                mt={2}
                borderRadius="full"
                size="sm"
                value={(mailProgress.done / mailProgress.total) * 100}
                colorScheme={mailProgress.failed.length ? 'orange' : 'blue'}
                isAnimated={mailProgress.running}
                hasStripe={mailProgress.running}
              />

              {mailProgress.running && mailProgress.current && (
                <Text fontSize="sm" color="gray.600" mt={2}>
                  Currently sending to {mailProgress.current}
                </Text>
              )}

              {!mailProgress.running && mailProgress.failed.length > 0 && (
                <Box mt={3}>
                  <Text fontSize="sm" fontWeight="semibold" color="orange.700">
                    Could not send to:
                  </Text>
                  <Text fontSize="sm" color="gray.700">
                    {mailProgress.failed.join(', ')}
                  </Text>
                </Box>
              )}
            </Box>
          )}

        {/* Table to display participant data along with the buttons-> batch mail and download partic. template */}
        <Box
          borderRadius="lg"
          borderWidth="1px"
          borderColor="gray.200"
          bg="white"
          display={'flex'}
          flexDirection={'column'}
          gap={0}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            px="4"
            pt="4"
          >
            <Text fontSize="lg" fontWeight="semibold">
              Participants Data
            </Text>

            {/* <Box display="flex" alignItems="center" gap="2"> */}
            <Tooltip
              label="Send email to all participants"
              hasArrow
              placement="bottom"
            >
              <IconButton
                aria-label="Send email to all participants"
                icon={<FiMail />}
                onClick={handleBatchMail}
                variant="ghost"
                size="lg"
                isDisabled={mailProgress.running}
              />
            </Tooltip>

            {/* <Tooltip
                label="Download participants Excel template"
                hasArrow
                placement="bottom"
              >
                <IconButton
                  aria-label="Download participant template"
                  icon={<FiDownload />}
                  variant="ghost"
                  size="lg"
                  onClick={() =>
                    window.open('/participant_template.xlsx', '_blank')
                  }
                />
              </Tooltip> */}
            {/* </Box> */}
          </Box>

          <TableContainer mt={4} overflowX="auto">
            {isLoading ? (
              <Text px="4" py="6">
                Loading data...
              </Text>
            ) : (
              <Table size="sm" variant="striped" colorScheme="gray">
                <Thead position="sticky" top="0" zIndex="1" bg="gray.50">
                  <Tr>
                    <Th>Name</Th>
                    <Th textAlign="center">Department</Th>
                    <Th textAlign="center">College</Th>
                    <Th textAlign="center">Type</Th>
                    <Th textAlign="center">Team Name</Th>
                    <Th textAlign="center">Position</Th>
                    <Th textAlign="center">Title-1</Th>
                    <Th textAlign="center">Title-2</Th>
                    <Th textAlign="center">Email</Th>
                    <Th textAlign="center">Certificate Type</Th>
                    <Th textAlign="center">Certificate Link</Th>
                    <Th textAlign="center">Mail Status</Th>
                    <Th textAlign="center">Actions</Th>
                  </Tr>
                </Thead>

                <Tbody>
                  {tableData.map((row, index) => (
                    <Tr key={row._id}>
                      <Td fontWeight="medium">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.name}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                name: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.name
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.department}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                department: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.department
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.college}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                college: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.college
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            width="80px"
                            value={editedData.types}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                types: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.types
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.teamName}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                teamName: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.teamName
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.position}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                position: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.position
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.title1}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                title1: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.title1
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.title2}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                title2: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.title2
                        )}
                      </Td>

                      <Td fontSize="sm">
                        {editRowId === row._id ? (
                          <Input
                            size="sm"
                            value={editedData.mailId}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                mailId: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.mailId
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Select
                            size="sm"
                            value={editedData.certiType}
                            onChange={(e) =>
                              setEditedData({
                                ...editedData,
                                certiType: e.target.value,
                              })
                            }
                          >
                            <option value="winner">Winner</option>
                            <option value="participant">Participant</option>
                            <option value="speaker">Speaker</option>
                            <option value="organizer">Organizer</option>
                          </Select>
                        ) : (
                          row.certiType
                        )}
                      </Td>

                      <Td textAlign="center">
                        {editRowId === row._id ? (
                          <Input size="sm" value={row._id} isDisabled />
                        ) : (
                          <ChakraLink
                            href={`${frontendHost}/cm/c/${eventId}/${row._id}`}
                            color="blue.500"
                            fontWeight="medium"
                            isExternal
                          >
                            View
                          </ChakraLink>
                        )}
                      </Td>

                      <Td
                        textAlign="center"
                        fontWeight="medium"
                        color={row.isCertificateSent ? 'green.600' : 'red.500'}
                      >
                        {row.isCertificateSent ? 'Sent' : 'Not sent'}
                      </Td>

                      <Td>
                        <Center gap="2" flexWrap="wrap">
                          {editRowId === row._id ? (
                            <IconButton
                              aria-label="Save"
                              icon={<FiCheck size={16} />}
                              size="sm"
                              variant="ghost"
                              colorScheme="blue"
                              _hover={{
                                bg: index % 2 === 0 ? 'white' : 'gray.50',
                              }}
                              onClick={handleSaveEdit}
                            />
                          ) : (
                            <HStack spacing="1" justify="center">
                              {(() => {
                                const isGrayRow = index % 2 === 0; // even = gray row
                                return (
                                  <>
                                    <IconButton
                                      aria-label="Edit"
                                      icon={<FiEdit2 size={16} />}
                                      size="sm"
                                      variant="ghost"
                                      _hover={{
                                        bg: isGrayRow ? 'white' : 'gray.100',
                                      }}
                                      onClick={() => handleEditClick(row._id)}
                                    />

                                    <IconButton
                                      aria-label="Delete"
                                      icon={<FiTrash2 size={16} />}
                                      size="sm"
                                      variant="ghost"
                                      colorScheme="red"
                                      _hover={{
                                        bg: isGrayRow ? 'white' : 'gray.100',
                                      }}
                                      onClick={() => handleDelete(row._id)}
                                    />

                                    <IconButton
                                      aria-label="Mail"
                                      icon={<FiMail size={16} />}
                                      size="sm"
                                      variant="ghost"
                                      _hover={{
                                        bg: isGrayRow ? 'white' : 'gray.100',
                                      }}
                                      onClick={() => handleMailClick(row._id)}
                                    />
                                  </>
                                );
                              })()}
                            </HStack>
                          )}
                        </Center>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TableContainer>
        </Box>
      </Box>
    </Container>
  );
}

export default Participant;
