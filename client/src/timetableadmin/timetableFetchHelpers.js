// Stateless fetch wrappers around the timetable module API. printSummary.jsx
// keeps its own copies because they double as status-setters; these exist so
// the institute-wide download page can pull the same data for any department
// code without owning per-department React state.
import { generateInitialTimetableData } from './timetableDataHelpers';

const asJson = async (response) => {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
};

export const fetchCurrentSession = async (apiUrl) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/allotment?action=current-status`, {
      credentials: 'include',
    })
  );
  return data.currentSession || '';
};

// One entry per department timetable in the session: { code, dept, session, ... }
export const fetchSessionTimetables = async (apiUrl, session) => {
  const data = await asJson(
    await fetch(
      `${apiUrl}/timetablemodule/timetable/getallcodes/${encodeURIComponent(session)}`,
      { credentials: 'include' }
    )
  );
  return Array.isArray(data) ? data : [];
};

export const fetchTTDetails = async (apiUrl, code) => {
  return asJson(
    await fetch(`${apiUrl}/timetablemodule/timetable/alldetails/${code}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
  );
};

export const fetchSubjectData = async (apiUrl, code) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/subject/subjectdetails/${code}`, {
      credentials: 'include',
    })
  );
  return Array.isArray(data) ? data : [];
};

export const fetchSemesters = async (apiUrl, code) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/addsem?code=${code}`, { credentials: 'include' })
  );
  return data.filter((sem) => sem.code === code).map((sem) => sem.sem);
};

export const fetchRooms = async (apiUrl, code) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/addroom?code=${code}`, { credentials: 'include' })
  );
  return data.filter((room) => room.code === code).map((room) => room.room);
};

export const fetchFaculties = async (apiUrl, code) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/addfaculty/all?code=${code}`, {
      credentials: 'include',
    })
  );
  return Array.isArray(data) ? data : [];
};

// The lock time is per-department, not per-semester, so callers fetch it once.
export const fetchSemLockTime = async (apiUrl, code) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/lock/viewsem/${code}`, { credentials: 'include' })
  );
  return data?.updatedTime?.lockTimeIST;
};

export const fetchSemTimetable = async (apiUrl, code, semester) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/lock/lockclasstt/${code}/${semester}`, {
      credentials: 'include',
    })
  );
  return {
    initialData: generateInitialTimetableData(data.timetableData, 'sem'),
    notes: data.notes,
  };
};

export const fetchFacultyTimetable = async (apiUrl, code, faculty) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/tt/viewfacultytt/${code}/${faculty}`, {
      credentials: 'include',
    })
  );
  return {
    initialData: generateInitialTimetableData(data.timetableData, 'faculty'),
    updateTime: data.updatedTime,
    notes: data.notes,
  };
};

export const fetchRoomTimetable = async (apiUrl, code, room) => {
  const data = await asJson(
    await fetch(`${apiUrl}/timetablemodule/tt/viewroomtt/${code}/${room}`, {
      credentials: 'include',
    })
  );
  return {
    initialData: generateInitialTimetableData(data.timetableData, 'room'),
    updateTime: data.updatedTime,
    notes: data.notes,
  };
};

export const fetchCommonLoad = async (apiUrl, code, faculty) => {
  try {
    return await asJson(
      await fetch(`${apiUrl}/timetablemodule/commonLoad/${code}/${faculty}`, {
        credentials: 'include',
      })
    );
  } catch (error) {
    // Common load is supplementary — a department without it should still
    // produce a faculty timetable rather than abort the whole institute run.
    return undefined;
  }
};
