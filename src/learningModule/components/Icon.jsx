/**
 * The learning module's icon set.
 *
 * Every icon in the module resolves through here so the whole product draws
 * from one vocabulary at one weight. Screens used to inline emoji — a brain for
 * a quiz, a snake for a coding exercise, an insect for a bug report — which
 * renders as a different picture on every platform, cannot take a colour from
 * the theme, and reads as decoration rather than as interface.
 *
 * The theme is one family, drawn one way: lucide's stroked outline icons on a
 * 24px grid, at a 1.75px stroke, sized off the text they sit beside, and always
 * in `currentColor` so they take the colour of their surroundings rather than
 * carrying one of their own. Nothing here is filled, and nothing is a picture
 * of a thing — which is why the rest of the module no longer imports Chakra's
 * solid icons either: two families in one screen read as a mistake. The admin
 * console already draws from this set, so the two now match.
 *
 * Names are semantic, not pictorial: call the coursework icon `quiz`, never
 * `list-checks`. Changing which glyph a `quiz` is drawn with is then one edit
 * here rather than a hunt through sixty screens.
 */
import {
  Award,
  Ban,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  CalendarOff,
  Camera,
  ChartColumn,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Code2,
  Compass,
  Database,
  Dices,
  DoorOpen,
  Download,
  Eye,
  EyeOff,
  Film,
  FileSpreadsheet,
  FileText,
  Flag,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Headphones,
  Home,
  Hourglass,
  IdCard,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Layers,
  LifeBuoy,
  Lightbulb,
  Link2,
  Library,
  Lock,
  Mail,
  MapPin,
  Maximize,
  Medal,
  Megaphone,
  Menu,
  Minus,
  MessageSquare,
  MessageSquareText,
  Microscope,
  Monitor,
  Paperclip,
  PenTool,
  Pencil,
  Percent,
  Pin,
  Play,
  Presentation,
  Radio,
  Receipt,
  Recycle,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Sparkles,
  Star,
  Table,
  Target,
  ThumbsUp,
  Timer,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Undo2,
  User,
  UserPlus,
  Users,
  Video,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

const ICONS = {
  // ── Navigation and chrome ──────────────────────────────────────────────
  brand: GraduationCap,
  menu: Menu,
  classes: Home,
  todo: ClipboardCheck,
  calendar: CalendarDays,
  timetable: Clock,
  notifications: Bell,
  'attendance-card': IdCard,
  progress: Award,
  suggestion: Wrench,
  'help-desk': LifeBuoy,
  admin: ShieldCheck,
  dashboard: ChartColumn,
  subjects: Library,
  'dev-team': Code2,

  // ── Coursework and activity types ──────────────────────────────────────
  assignment: FileText,
  quiz: ClipboardList,
  exam: GraduationCap,
  question: CircleHelp,
  material: BookOpen,
  coding: Code2,
  notebook: Code2,
  tutorial: Calculator,
  form: FileSpreadsheet,
  short: Zap,
  lab: Microscope,
  discussion: MessageSquare,
  people: Users,
  grades: Percent,
  leaderboard: Trophy,
  attendance: ClipboardCheck,
  insights: ChartColumn,
  stream: Megaphone,
  manual: BookOpen,
  ai: Sparkles,

  // ── Notification kinds ─────────────────────────────────────────────────
  announcement: Megaphone,
  coursework: FileText,
  comment: MessageSquare,
  grade: Percent,
  submission: Inbox,
  invite: Mail,
  'join-request': UserPlus,
  'quiz-result': Target,
  feedback: MessageSquareText,

  // ── Callouts and status ────────────────────────────────────────────────
  info: CircleAlert,
  tip: Lightbulb,
  warning: TriangleAlert,
  danger: Ban,
  key: KeyRound,
  success: CircleCheck,
  error: CircleAlert,
  pending: Hourglass,
  live: Radio,
  locked: Lock,
  blocked: Ban,
  empty: Inbox,

  // ── Actions and affordances ────────────────────────────────────────────
  edit: Pencil,
  write: PenTool,
  delete: Trash2,
  download: Download,
  import: Download,
  refresh: RefreshCw,
  settings: Settings,
  search: Search,
  preview: Eye,
  hide: EyeOff,
  play: Play,
  present: Presentation,
  fullscreen: Maximize,
  link: Link2,
  attachment: Paperclip,
  pin: Pin,
  shuffle: Shuffle,
  sequence: Layers,
  cards: Layers,
  back: Undo2,
  minus: Minus,
  random: Dices,
  reuse: Recycle,
  exit: DoorOpen,
  finish: Flag,
  check: Check,
  close: X,
  table: Table,
  bank: FolderOpen,
  archive: Database,

  // ── Media and devices ──────────────────────────────────────────────────
  image: ImageIcon,
  video: Film,
  webcam: Video,
  audio: Headphones,
  camera: Camera,
  desktop: Monitor,
  mobile: Smartphone,

  // ── Odds and ends ──────────────────────────────────────────────────────
  user: User,
  time: Clock,
  timer: Timer,
  location: MapPin,
  receipt: Receipt,
  calculator: Calculator,
  test: FlaskConical,
  geometry: Ruler,
  star: Star,
  like: ThumbsUp,
  medal: Medal,
  trophy: Trophy,
  holiday: CalendarOff,
  compass: Compass,
  'trend-up': TrendingUp,
  document: FileText,
};

/**
 * Draws one icon from the set.
 *
 * `size` is in pixels and applies to both axes; the default matches the 14px
 * body text most of the module is set in. `strokeWidth` is deliberately light
 * — a 2px stroke at 14px reads as a blob.
 *
 * Unknown names render nothing rather than throwing: an icon is decoration,
 * and a typo in one should never take a screen down.
 */
export function LmIcon({ name, size = 16, strokeWidth = 1.75, style, ...rest }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'text-bottom', ...style }}
      {...rest}
    />
  );
}

export default LmIcon;
