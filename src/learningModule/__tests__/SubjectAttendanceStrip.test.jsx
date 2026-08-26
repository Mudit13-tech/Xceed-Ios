import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubjectAttendanceStrip, { matchSubjectRecords } from '../components/SubjectAttendanceStrip';
import StudentAttendanceMap from '../components/StudentAttendanceMap';
import lmApi from '../api/lmApi';

vi.mock('../api/lmApi', () => ({
  default: {
    myProfile: vi.fn(),
  },
}));

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('SubjectAttendanceStrip matchSubjectRecords logic', () => {
  const history = [
    {
      reportId: '1',
      date: '2026-03-12',
      timeSlot: '9:30-10:30',
      subject: 'DSP',
      subjectFullName: 'Digital Signal Processing',
      finalStatus: 'P',
      semester: '6',
    },
    {
      reportId: '2',
      date: '2026-03-10',
      timeSlot: '8:30-9:30',
      subject: 'DSP',
      subjectFullName: 'Digital Signal Processing',
      finalStatus: 'A',
      semester: '6',
    },
    {
      reportId: '3',
      date: '2026-03-11',
      timeSlot: '10:30-11:30',
      subject: 'VLSI',
      subjectFullName: 'VLSI Design',
      finalStatus: 'P',
      semester: '6',
    },
    {
      reportId: '4',
      date: '2026-03-15',
      timeSlot: '8:30-9:30',
      subject: 'DSP',
      subjectFullName: 'Digital Signal Processing',
      finalStatus: 'P',
      semester: '6',
    },
  ];

  it('filters records matching subject abbreviation and sorts them chronologically', () => {
    const klass = {
      name: 'Digital Signal Processing',
      subject: 'DSP',
      subjectCode: 'ECPC-306',
      semester: '6',
    };

    const matched = matchSubjectRecords(history, klass);
    expect(matched.length).toBe(3);
    // Chronological order: Mar 10, Mar 12, Mar 15
    expect(matched[0].date).toBe('2026-03-10');
    expect(matched[0].finalStatus).toBe('A');
    expect(matched[1].date).toBe('2026-03-12');
    expect(matched[1].finalStatus).toBe('P');
    expect(matched[2].date).toBe('2026-03-15');
    expect(matched[2].finalStatus).toBe('P');
  });

  it('matches by subject name or subjectCode even if abbreviation is omitted', () => {
    const klass = {
      name: 'VLSI Design',
      subject: '',
      subjectCode: 'VLSI',
      semester: '6',
    };

    const matched = matchSubjectRecords(history, klass);
    expect(matched.length).toBe(1);
    expect(matched[0].subject).toBe('VLSI');
    expect(matched[0].finalStatus).toBe('P');
  });

  it('returns empty array when history is empty or class is undefined', () => {
    expect(matchSubjectRecords([], { subject: 'DSP' })).toEqual([]);
    expect(matchSubjectRecords(history, null)).toEqual([]);
  });
});

describe('<SubjectAttendanceStrip /> Component', () => {
  it('renders empty state note when no attendance records exist for the subject', async () => {
    lmApi.myProfile.mockResolvedValueOnce({
      attendanceHistory: [
        {
          reportId: '1',
          date: '2026-03-10',
          subject: 'OtherSubject',
          finalStatus: 'P',
        },
      ],
    });

    const klass = {
      name: 'Digital Signal Processing',
      subject: 'DSP',
    };

    renderWithQuery(<SubjectAttendanceStrip klass={klass} />);

    expect(await screen.findByText(/No attendance recorded yet for this subject/i)).toBeInTheDocument();
  });

  it('renders attendance percentage, stats, and status badge for matched classes', async () => {
    lmApi.myProfile.mockResolvedValueOnce({
      attendanceHistory: [
        {
          reportId: '1',
          date: '2026-03-10',
          timeSlot: '8:30-9:30',
          subject: 'DSP',
          subjectFullName: 'Digital Signal Processing',
          finalStatus: 'P',
          faculty: 'Dr. Sharma',
        },
        {
          reportId: '2',
          date: '2026-03-11',
          timeSlot: '8:30-9:30',
          subject: 'DSP',
          subjectFullName: 'Digital Signal Processing',
          finalStatus: 'A',
          faculty: 'Dr. Sharma',
        },
        {
          reportId: '3',
          date: '2026-03-12',
          timeSlot: '8:30-9:30',
          subject: 'DSP',
          subjectFullName: 'Digital Signal Processing',
          finalStatus: 'P',
          faculty: 'Dr. Sharma',
        },
        {
          reportId: '4',
          date: '2026-03-13',
          timeSlot: '8:30-9:30',
          subject: 'DSP',
          subjectFullName: 'Digital Signal Processing',
          finalStatus: 'P',
          faculty: 'Dr. Sharma',
        },
      ],
    });

    const klass = {
      name: 'Digital Signal Processing',
      subject: 'DSP',
    };

    renderWithQuery(<SubjectAttendanceStrip klass={klass} />);

    // 3 out of 4 = 75% -> Eligible
    expect(await screen.findByText(/75%/i)).toBeInTheDocument();
    expect(screen.getByText('(3/4 Present)')).toBeInTheDocument();
    expect(screen.getByText('Eligible')).toBeInTheDocument();
  });
});

describe('<StudentAttendanceMap /> Component', () => {
  it('renders contribution map with accurate legend without errors', () => {
    const history = [
      {
        reportId: '1',
        date: '2026-03-10',
        timeSlot: '8:30-9:30',
        subject: 'DSP',
        finalStatus: 'P',
        semester: '6',
      },
      {
        reportId: '2',
        date: '2026-03-10',
        timeSlot: '10:30-11:30',
        subject: 'VLSI',
        finalStatus: 'A',
        semester: '6',
      },
    ];

    const academicSessions = [
      {
        session: '2025-2026 (Even)',
        startingDate: '2026-01-08',
        endingDate: '2026-06-09',
        nonWorkingDays: [{ date: '2026-01-26', remark: 'Republic Day' }],
      },
    ];

    render(
      <StudentAttendanceMap
        history={history}
        academicSessions={academicSessions}
        currentSession="2025-2026 (Even)"
        studentRollNo="22104032"
      />
    );

    expect(screen.getByText(/Attendance Contribution Map/i)).toBeInTheDocument();
    expect(screen.getByText(/Roll No: 22104032/i)).toBeInTheDocument();
    expect(screen.getByText(/Present \(100%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Partial \(< 100%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Absent \(0%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Holiday \/ Weekend/i)).toBeInTheDocument();
    expect(screen.getByText(/No Classes/i)).toBeInTheDocument();
  });
});
