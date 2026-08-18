import React, { useEffect, useState } from 'react';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';
import getEnvironment from '../../getenvironment';
import ViewTimetable from '../../timetableadmin/viewtt';

const generateInitialTimetableData = (fetchedData, type) => {
  const initialData = {};
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8, 'lunch'];

  for (const day of days) {
    initialData[day] = {};
    for (const period of periods) {
      if (period === 'lunch') {
        initialData[day]['lunch'] = [];
        if (fetchedData[day] && fetchedData[day]['lunch']) {
          const slotData = fetchedData[day]['lunch'];
          for (const slot of slotData) {
            const slotSubjects = [];
            for (const slotItem of slot) {
              const subj = slotItem.subject || '';
              const room = type === 'room' ? (slotItem.sem || '') : (slotItem.room || '');
              const faculty = type === 'faculty' ? (slotItem.sem || '') : (slotItem.faculty || '');
              if (subj || room || faculty) {
                slotSubjects.push({ subject: subj, room, faculty });
              }
            }
            if (slotSubjects.length > 0) {
              initialData[day]['lunch'].push(slotSubjects);
            }
          }
        }
      } else {
        initialData[day][`period${period}`] = [];
        if (fetchedData[day] && fetchedData[day][`period${period}`]) {
          const slotData = fetchedData[day][`period${period}`];
          for (const slot of slotData) {
            const slotSubjects = [];
            for (const slotItem of slot) {
              const subj = slotItem.subject || '';
              const room = type === 'room' ? (slotItem.sem || '') : (slotItem.room || '');
              const faculty = type === 'faculty' ? (slotItem.sem || '') : (slotItem.faculty || '');
              if (subj || room || faculty) {
                slotSubjects.push({ subject: subj, room, faculty });
              }
            }
            if (slotSubjects.length === 0) {
              slotSubjects.push({ subject: '', room: '', faculty: '' });
            }
            initialData[day][`period${period}`].push(slotSubjects);
          }
        } else {
          initialData[day][`period${period}`].push([]);
        }
      }
    }
  }
  return initialData;
};

export default function TimetableWidget({ me }) {
  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = getEnvironment();

        const fetchWithAuth = async (url, options = {}) => {
          const headers = options.headers || {};
          const token = localStorage.getItem('token');
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          return fetch(url, { ...options, headers, credentials: 'include' });
        };

        // The faculty timetable: name -> current session -> weekly grid. The
        // student path that used to sit alongside this passed a department where
        // the endpoint wanted a session code, so it fetched nothing; students now
        // go through learningModule/pages/Timetable instead, and this component is
        // only rendered for faculty.
        const facultyRes = await fetchWithAuth(`${apiUrl}/timetablemodule/faculty`);
        if (!facultyRes.ok) throw new Error('Could not fetch faculties');
        const faculties = await facultyRes.json();
        const currentFaculty = faculties.find((f) => f.email && f.email.toLowerCase() === me?.email?.toLowerCase());

        if (!currentFaculty) {
          setError('No timetable found for your email address.');
          setTimetableData(null);
          return;
        }

        const { name: facultyName } = currentFaculty;
        if (!facultyName) {
          setError('Missing faculty name.');
          setTimetableData(null);
          return;
        }

        const sessionRes = await fetchWithAuth(`${apiUrl}/timetablemodule/timetable/get-current-session`, { method: 'POST' });
        if (!sessionRes.ok) throw new Error('Could not fetch current session');
        const sessionData = await sessionRes.json();
        const codes = sessionData.codes || [];
        if (codes.length === 0) {
          setError('No active timetable session found.');
          setTimetableData(null);
          return;
        }
        
        const sessionCode = codes[0];

        const response = await fetchWithAuth(`${apiUrl}/timetablemodule/tt/viewfacultytt/${sessionCode}/${encodeURIComponent(facultyName)}`);
        if (response.ok) {
          const result = await response.json();
          const data = result.timetableData || result; // API might wrap it depending on endpoint
          setTimetableData(generateInitialTimetableData(data, 'faculty'));
        } else {
          setError('Could not fetch faculty timetable.');
        }
      } catch (err) {
        console.error(err);
        setError(err.message || 'An error occurred loading the timetable.');
      } finally {
        setLoading(false);
      }
    };

    if (me) {
      fetchTimetable();
    } else {
      setLoading(false);
    }
  }, [me]);

  if (loading) {
    return (
      <VStack p={6} spacing={4}>
        <Spinner color="purple.500" />
        <Text color="lmFg.muted">Loading your timetable...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <Box p={4} bg="lmHue.red50" borderRadius="md" color="red.600">
        <Text fontSize="sm">{error}</Text>
      </Box>
    );
  }

  if (!timetableData || Object.keys(timetableData).length === 0) {
    return (
      <Box p={4} bg="lmBg.sunken" borderRadius="md" color="lmFg.muted">
        <Text fontSize="sm">No timetable available.</Text>
      </Box>
    );
  }

  return (
    <Box mt={4}>
      <ViewTimetable timetableData={timetableData} />
    </Box>
  );
}
