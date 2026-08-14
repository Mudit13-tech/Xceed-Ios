// Pure timetable-shaping and summary helpers shared by the per-department
// print page (printSummary.jsx) and the institute-wide merged download page
// (instituteMergedDownload.jsx). Nothing here touches React state, so both
// pages produce byte-identical PDFs from the same inputs.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const generateInitialTimetableData = (fetchedData, type) => {
  const initialData = {};
  const periods = [1, 2, 3, 4, 5, 6, 7, 8, 'lunch'];

  for (const day of DAYS) {
    initialData[day] = {};
    for (const period of periods) {
      if (period == 'lunch') {
        initialData[day]['lunch'] = [];
        if (fetchedData[day] && fetchedData[day]['lunch']) {
          const slotData = fetchedData[day]['lunch'];
          for (const slot of slotData) {
            const slotSubjects = [];
            let faculty = '';
            let room = '';
            for (const slotItem of slot) {
              const subj = slotItem.subject || '';
              if (type == 'room') {
                room = slotItem.sem || '';
              } else {
                room = slotItem.room || '';
              }
              if (type == 'faculty') {
                faculty = slotItem.sem || '';
              } else {
                faculty = slotItem.faculty || '';
              }
              if (subj || room || faculty) {
                slotSubjects.push({ subject: subj, room: room, faculty: faculty });
              }
            }
            initialData[day]['lunch'].push(slotSubjects);
          }
        }
      } else {
        initialData[day][`period${period}`] = [];
        if (fetchedData[day] && fetchedData[day][`period${period}`]) {
          const slotData = fetchedData[day][`period${period}`];
          for (const slot of slotData) {
            const slotSubjects = [];
            let faculty = '';
            let room = '';
            for (const slotItem of slot) {
              const subj = slotItem.subject || '';
              if (type == 'room') {
                room = slotItem.sem || '';
              } else {
                room = slotItem.room || '';
              }
              if (type == 'faculty') {
                faculty = slotItem.sem || '';
              } else {
                faculty = slotItem.faculty || '';
              }
              if (subj || room || faculty) {
                slotSubjects.push({ subject: subj, room: room, faculty: faculty });
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

export function generateSummary(timetableData, subjectData, type, headTitle, commonLoad) {
  const summaryData = {};
  for (const day in timetableData) {
    for (let period = 1; period <= 9; period++) {
      let slots = '';
      if (period == 9) {
        slots = timetableData[day]['lunch'];
      } else {
        slots = timetableData[day][`period${period}`];
      }
      if (slots) {
        slots.forEach((slot) => {
          slot.forEach((cell) => {
            // Lunch duty counts as 1 hr of load for the assigned faculty.
            if (type == 'faculty' && period == 9) {
              if (cell.subject || cell.room || cell.faculty) {
                const key = 'Lunch';
                if (!summaryData[key]) {
                  summaryData[key] = {
                    subCode: 'LUNCH',
                    count: 1,
                    faculties: [],
                    subType: 'lunch',
                    rooms: [],
                    subjectFullName: 'Lunch Duty',
                    subSem: '',
                  };
                } else {
                  summaryData[key].count++;
                }
              }
              return;
            }

            if (cell.subject) {
              const { subject, faculty, room } = cell;
              let foundSubject = '';
              if (type == 'faculty') {
                foundSubject = subjectData.find(item => item.subName === subject && item.sem === faculty);
              } else if (type == 'room') {
                foundSubject = subjectData.find(item => item.subName === subject && item.sem === room);
              } else if (type == 'sem') {
                foundSubject = subjectData.find(item => item.subName === subject && item.sem === headTitle);
              }
              if (foundSubject) {
                if (!summaryData[subject]) {
                  summaryData[subject] = {
                    subCode: foundSubject.subCode,
                    count: 1,
                    faculties: [faculty],
                    subType: foundSubject.type,
                    rooms: [room],
                    subjectFullName: foundSubject.subjectFullName,
                    subSem: foundSubject.sem,
                  };
                } else {
                  summaryData[subject].count++;
                  if (!summaryData[subject].faculties.includes(faculty)) {
                    summaryData[subject].faculties.push(faculty);
                  }
                  if (!summaryData[subject].rooms.includes(room)) {
                    summaryData[subject].rooms.push(room);
                  }
                }
              }
            }
          });
        });
      }
    }
  }

  const mergedSummaryData = {};
  for (const key in summaryData) {
    const entry = summaryData[key];
    let isMerged = false;
    for (const existingKey in mergedSummaryData) {
      const existingEntry = mergedSummaryData[existingKey];
      if (
        entry.faculties.every(faculty => existingEntry.faculties.includes(faculty)) &&
        entry.subType === existingEntry.subType &&
        entry.subjectFullName === existingEntry.subjectFullName &&
        entry.rooms.every(room => existingEntry.rooms.includes(room))
      ) {
        existingEntry.count += entry.count;
        existingEntry.faculties = [...new Set([...existingEntry.faculties, ...entry.faculties])];
        existingEntry.originalKeys.push(key);
        isMerged = true;
        break;
      }
    }
    if (!isMerged) {
      mergedSummaryData[key] = { ...entry, originalKeys: [key] };
    }
  }

  const sortedSummary = Object.values(mergedSummaryData).sort((a, b) => {
    const subCodeComparison = a.subCode.localeCompare(b.subCode);
    if (subCodeComparison !== 0) {
      return subCodeComparison;
    }
    const subtypePriority = (subtype) => {
      switch (subtype.toLowerCase()) {
        case 'theory': return 0;
        case 'tutorial': return 1;
        case 'laboratory': return 2;
        default: return 3;
      }
    };
    return subtypePriority(a.subType) - subtypePriority(b.subType);
  });

  let sortedSummaryEntries = { ...sortedSummary };
  if (commonLoad) {
    commonLoad.forEach((commonLoadItem) => {
      sortedSummaryEntries = {
        ...sortedSummaryEntries,
        [commonLoadItem.subCode]: {
          ...sortedSummaryEntries[commonLoadItem.subCode],
          count: commonLoadItem.hrs,
          faculties: [],
          originalKeys: [commonLoadItem.subName],
          rooms: [],
          subCode: commonLoadItem.subCode,
          subjectFullName: commonLoadItem.subFullName,
          subType: commonLoadItem.subType,
          subSem: commonLoadItem.sem,
        },
      };
    });
  }
  return sortedSummaryEntries;
}
