export interface FacilityItem {
  id: string;
  index: string;
  title: string;
  zoneLabel: string;
  description: string;
  highlights: string[];
  placeholderNotice: string;
  image?: string;
  imageAlt?: string;
  spanWide?: boolean;
}

export interface TrainingProgram {
  id: string;
  index: string;
  name: string;
  categoryNote: string;
  summary: string;
  focusPoints: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'Strength' | 'Conditioning' | 'Studio';
  image: string;
  alt: string;
  caption: string;
  placeholderNotice: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  duration: string;
  pricePlaceholder: string;
  priceNote: string;
  featured?: boolean;
  features: string[];
}

export const BUSINESS_INFO = {
  brandName: 'ASSURE FITNESS CLUB',
  legalName: 'ASSURE FITNESS CLUB LLP',
  tagline: 'YOUR FITNESS. YOUR POWER. YOUR LEGACY.',
  heroHeadline: 'BUILD YOUR STRONGER SELF.',
  address:
    'J-601, White Business Hub, Near Hanspura Gam, Degam Road, Naroda, Ahmedabad, Gujarat 382330, India',
  shortLocation: 'Naroda, Ahmedabad · Near Hanspura Gam',
  website: 'assurefitness.shop',
  closingHours: 'Closes 11:00 PM (opening hours pending owner confirmation)',
  hoursPlaceholder: 'Opening hours pending owner confirmation',
} as const;

export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Facilities', href: '#facilities' },
  { label: 'Training', href: '#training' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Membership', href: '#membership' },
  { label: 'Contact', href: '#contact' },
] as const;

export const HERO_MEDIA = {
  backdrop: '/src/assets/images/hero_gym_atmosphere_1794557355832.jpg',
  alt: 'Architectural gym training floor placeholder visual showing power racks and dark stone lighting',
};

export const ABOUT_MEDIA = {
  image: '/src/assets/images/about_editorial_training_1794557355894.jpg',
  alt: 'Illustrative functional strength training visual placeholder featuring kettlebells and steel rig',
  caption: 'Illustrative Visual Placeholder — Replace with official Assure Fitness Club photography',
};

export const FACILITIES: FacilityItem[] = [
  {
    id: 'strength-bay',
    index: '01',
    title: 'Strength & Free Weights Bay',
    zoneLabel: 'Proposed Equipment Zone',
    description:
      'Dedicated floor layout planned for free weights, plate-loaded stations, and progressive resistance training.',
    highlights: [
      'Editable: Confirm exact barbell & dumbbell weight range',
      'Editable: List power racks, benches & cable stations',
    ],
    placeholderNotice: 'Editable facility card — confirm actual gym equipment with owner',
    image: '/src/assets/images/facility_strength_zone_1794557356142.jpg',
    imageAlt: 'Illustrative strength training rack and dumbbell visual placeholder',
    spanWide: true,
  },
  {
    id: 'cardio-floor',
    index: '02',
    title: 'Cardio & Conditioning Zone',
    zoneLabel: 'Proposed Conditioning Floor',
    description:
      'Structured endurance area for cardiovascular conditioning, warm-ups, and steady-state or interval sessions.',
    highlights: [
      'Editable: Confirm treadmill, cycle & elliptical count',
      'Editable: Add air-conditioning & ventilation specs',
    ],
    placeholderNotice: 'Editable facility card — confirm cardio machine lineup with owner',
    image: '/src/assets/images/gallery_cardio_studio_clean_1794557372124.jpg',
    imageAlt: 'Illustrative modern cardio equipment floor visual placeholder',
  },
  {
    id: 'functional-zone',
    index: '03',
    title: 'Functional Training & Mobility',
    zoneLabel: 'Proposed Movement Space',
    description:
      'Open turf or floor space designed for kettlebell work, core conditioning, bodyweight drills, and guided stretching.',
    highlights: [
      'Editable: Confirm functional rig, sled or turf availability',
      'Editable: Add locker, shower & changing room details',
    ],
    placeholderNotice: 'Editable facility card — confirm floor amenities with owner',
  },
  {
    id: 'studio-floor',
    index: '04',
    title: 'Group Studio & Member Amenities',
    zoneLabel: 'Proposed Studio & Comfort',
    description:
      'Supportive shared studio space and essential member conveniences tailored for consistent daily workouts.',
    highlights: [
      'Editable: Confirm studio capacity & sound system',
      'Editable: Add parking, drinking water & hygiene details',
    ],
    placeholderNotice: 'Editable facility card — confirm studio & club amenities with owner',
    image: '/src/assets/images/gallery_group_studio_1794557357331.jpg',
    imageAlt: 'Illustrative group fitness studio interior visual placeholder',
    spanWide: true,
  },
];

export const TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: 'strength-training',
    index: '01',
    name: 'Strength Training',
    categoryNote: 'Proposed Category · Confirm with owner',
    summary:
      'Structured resistance training focused on foundational compound lifts, progressive overload, and safe movement mechanics.',
    focusPoints: [
      'Editable: Add beginner to advanced split options',
      'Editable: Confirm floor coach assistance timings',
    ],
  },
  {
    id: 'personal-training',
    index: '02',
    name: 'Personal Training',
    categoryNote: 'Proposed Category · Confirm with owner',
    summary:
      'One-on-one coaching support tailored around individual fitness baselines, technique refinement, and accountability.',
    focusPoints: [
      'Editable: Confirm certified trainer availability',
      'Editable: Specify assessment & session structure',
    ],
  },
  {
    id: 'weight-management',
    index: '03',
    name: 'Weight Management',
    categoryNote: 'Proposed Category · Confirm with owner',
    summary:
      'Balanced resistance and conditioning routines designed to support sustainable body composition and stamina goals.',
    focusPoints: [
      'Editable: Confirm body composition tracking tools',
      'Editable: Add guidance scope offered by the club',
    ],
  },
  {
    id: 'group-fitness',
    index: '04',
    name: 'Group Fitness',
    categoryNote: 'Proposed Category · Confirm with owner',
    summary:
      'High-energy community sessions that bring structure, camaraderie, and motivating pacing to your weekly routine.',
    focusPoints: [
      'Editable: Publish morning & evening batch schedule',
      'Editable: Confirm maximum batch capacity',
    ],
  },
  {
    id: 'zumba',
    index: '05',
    name: 'Zumba',
    categoryNote: 'Proposed Category · Confirm with owner',
    summary:
      'Rhythm-driven cardio workouts blending upbeat choreography with endurance conditioning in a welcoming group setting.',
    focusPoints: [
      'Editable: Confirm weekly Zumba class days & timings',
      'Editable: Confirm inclusion in standard or add-on pass',
    ],
  },
];

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'gal-1',
    title: 'Main Training Floor Concept',
    category: 'Strength',
    image: '/src/assets/images/hero_gym_atmosphere_1794557355832.jpg',
    alt: 'Illustrative strength training floor placeholder image with racks and ambient lighting',
    caption: 'Sample Atmospheric Visual — Replace with real Assure Fitness Club floor photo',
    placeholderNotice: 'Visual Placeholder',
  },
  {
    id: 'gal-2',
    title: 'Free Weights & Dumbbells',
    category: 'Strength',
    image: '/src/assets/images/facility_strength_zone_1794557356142.jpg',
    alt: 'Illustrative dumbbell rack and bench visual placeholder',
    caption: 'Sample Free Weights Visual — Replace with real club equipment photo',
    placeholderNotice: 'Visual Placeholder',
  },
  {
    id: 'gal-3',
    title: 'Cardio & Conditioning Row',
    category: 'Conditioning',
    image: '/src/assets/images/gallery_cardio_studio_clean_1794557372124.jpg',
    alt: 'Illustrative cardio treadmills and rowers visual placeholder',
    caption: 'Sample Conditioning Zone Visual — Replace with real club cardio floor photo',
    placeholderNotice: 'Visual Placeholder',
  },
  {
    id: 'gal-4',
    title: 'Functional & Kettlebell Bay',
    category: 'Conditioning',
    image: '/src/assets/images/about_editorial_training_1794557355894.jpg',
    alt: 'Illustrative functional kettlebell training visual placeholder',
    caption: 'Sample Functional Training Visual — Replace with real club training photo',
    placeholderNotice: 'Visual Placeholder',
  },
  {
    id: 'gal-5',
    title: 'Group & Zumba Studio',
    category: 'Studio',
    image: '/src/assets/images/gallery_group_studio_1794557357331.jpg',
    alt: 'Illustrative group fitness studio mirror and hardwood floor visual placeholder',
    caption: 'Sample Group Studio Visual — Replace with real Assure Fitness Club studio photo',
    placeholderNotice: 'Visual Placeholder',
  },
];

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'monthly-access',
    name: 'Monthly Access',
    duration: '1 Month · Draft Duration',
    pricePlaceholder: '₹ [Confirm Price]',
    priceNote: 'Pending owner approval — request current tariff via enquiry form',
    features: [
      'Editable: General gym floor access during approved club hours',
      'Editable: Locker & changing room access (confirm)',
      'Editable: Initial floor orientation (confirm)',
    ],
  },
  {
    id: 'quarterly-pass',
    name: 'Quarterly Commitment',
    duration: '3 Months · Draft Duration',
    pricePlaceholder: '₹ [Confirm Price]',
    priceNote: 'Pending owner approval — request 3-month tariff & inclusions',
    featured: true,
    features: [
      'Editable: Full access to strength & cardio zones',
      'Editable: Group class / Zumba inclusion (confirm)',
      'Editable: Progress check-in options (confirm)',
    ],
  },
  {
    id: 'annual-club',
    name: 'Annual Club Pass',
    duration: '12 Months · Draft Duration',
    pricePlaceholder: '₹ [Confirm Price]',
    priceNote: 'Pending owner approval — confirm annual fee & freeze policy',
    features: [
      'Editable: Year-round club access during approved hours',
      'Editable: Personal training add-on eligibility (confirm)',
      'Editable: Guest pass or renewal terms (confirm)',
    ],
  },
];

export const SOCIAL_PLACEHOLDERS = [
  { label: 'Instagram [Update URL]', href: '#contact', note: 'Add official handle' },
  { label: 'Facebook [Update URL]', href: '#contact', note: 'Add official page' },
  { label: 'YouTube [Update URL]', href: '#contact', note: 'Add official channel' },
] as const;
