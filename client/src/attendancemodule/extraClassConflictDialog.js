export function extraClassConflictDialogOptions(type) {
  if (type === 'regular_timetable') {
    return {
      isRegular: true,
      allowChangeRoom: true,
      allowReplace: true,
    };
  }
  if (type === 'ambiguous_timetable') {
    return {
      title: 'Multiple current-session timetables use this slot',
      explanation:
        'This conflict cannot be overridden. Choose a different room or ask an administrator to correct the timetable data.',
      allowChangeRoom: true,
      allowReplace: false,
      cancelLabel: 'Close',
    };
  }
  if (type === 'faculty_regular_busy' || type === 'faculty_extra_busy') {
    return {
      title: 'Faculty member is already teaching at this time',
      explanation:
        'This conflict cannot be overridden. Choose another faculty member or period.',
      allowChangeRoom: false,
      allowReplace: false,
      cancelLabel: 'Close',
    };
  }
  return {
    allowChangeRoom: false,
    allowReplace: true,
  };
}
