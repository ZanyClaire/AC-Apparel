/* ============================================================
   Aethel & Code — catalog
   Each physical garment carries a digital twin. Digital-only
   pieces are stand-alone assets delivered by email.
   ============================================================ */

const CATALOG = [
  {
    slug: 'cirque-trouser',
    name: 'Cirque Trouser',
    category: 'Trousers',
    kind: 'physical',
    price: 280,
    plate: 'ridge',
    palette: { p1: '#3b3c35', p2: '#7b7869', p3: '#141512' },
    colorways: [
      { name: 'Charcoal', hex: '#3b3c35' },
      { name: 'Stone', hex: '#8d8778' },
      { name: 'Ink', hex: '#22241f' }
    ],
    sizes: ['28', '30', '32', '34', '36'],
    soldOut: ['28'],
    material: 'Italian wool, 320gsm',
    blurb:
      'A wide, weighted leg that falls clean from the hip. Cut from a dry Italian wool with just enough body to hold its line over a day of walking.',
    specs: [
      'Wide leg with a single forward pleat',
      'Hidden hook-and-bar closure, extended waistband',
      'Unlined, with taped seams and a deep welt pocket',
      'Woven and finished in Biella, Italy'
    ],
    fit: 'High rise, relaxed through the thigh, straight to the floor. Take your usual size; size down for a closer line.',
    care: 'Dry clean sparingly. Air between wears. Steam to reset the crease.',
    twin: { name: 'The Digital Cirque', price: 45 }
  },
  {
    slug: 'ridgeline-shell',
    name: 'Ridgeline Shell',
    category: 'Outerwear',
    kind: 'physical',
    price: 420,
    plate: 'fog',
    palette: { p1: '#22352b', p2: '#4e6354', p3: '#0d1410' },
    colorways: [
      { name: 'Forest', hex: '#22352b' },
      { name: 'Slate', hex: '#4a4f52' },
      { name: 'Bone', hex: '#cfc7b5' }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    soldOut: [],
    material: '3-layer recycled nylon, PFC-free',
    blurb:
      'Built for weather that changes its mind. A quiet, unlined shell with taped seams, a high collar and a hood that holds its shape in wind.',
    specs: [
      '3L recycled nylon with a matte face',
      '20k / 20k waterproof-breathable membrane',
      'Articulated sleeve, gusseted underarm',
      'Two-way front zip with a storm flap'
    ],
    fit: 'Regular, with room for a mid-layer. Sits at the hip.',
    care: 'Machine wash cold with technical detergent. Tumble low to reactivate the DWR. Never use softener.',
    twin: { name: 'The Digital Ridgeline', price: 55 }
  },
  {
    slug: 'meridian-overshirt',
    name: 'Meridian Overshirt',
    category: 'Shirts',
    kind: 'physical',
    price: 195,
    plate: 'dune',
    palette: { p1: '#8b8272', p2: '#c6bda9', p3: '#5c584d' },
    colorways: [
      { name: 'Oat', hex: '#c6bda9' },
      { name: 'Clay', hex: '#9c7f68' },
      { name: 'Moss', hex: '#6b7259' }
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    soldOut: ['XL'],
    material: 'Brushed organic cotton twill',
    blurb:
      'The layer between a shirt and a jacket. Brushed cotton with a soft hand, cut square through the body so it layers without bulk.',
    specs: [
      'Brushed organic cotton twill, 240gsm',
      'Corozo buttons, patch chest pocket',
      'Split back yoke for movement',
      'Garment-washed for a broken-in feel'
    ],
    fit: 'Boxy and slightly cropped. Size down for a shirt fit.',
    care: 'Machine wash cold, inside out. Line dry.',
    twin: { name: 'Meridian Digital Study', price: 35 }
  },
  {
    slug: 'altimeter-vest',
    name: 'Altimeter Vest',
    category: 'Outerwear',
    kind: 'physical',
    price: 240,
    plate: 'studio',
    palette: { p1: '#5e5c52', p2: '#928d7d', p3: '#25261f' },
    colorways: [
      { name: 'Stone', hex: '#928d7d' },
      { name: 'Ink', hex: '#2c2e28' }
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    soldOut: [],
    material: 'Recycled ripstop, 700-fill down',
    blurb:
      'Warmth without weight, packed into a shell that disappears under a coat. The baffles are stitched narrow to keep the down where it belongs.',
    specs: [
      'Recycled 20D ripstop with a matte finish',
      '700-fill responsible down, 90/10',
      'Two zipped hand pockets, one internal',
      'Packs into its own pocket'
    ],
    fit: 'Slim through the chest, straight hem. Layers under the Ridgeline Shell.',
    care: 'Machine wash cold with down detergent. Tumble low with dryer balls.',
    twin: { name: 'Altimeter Digital Study', price: 35 }
  },
  {
    slug: 'base-layer-no-1',
    name: 'Base Layer No. 1',
    category: 'Knitwear',
    kind: 'physical',
    price: 95,
    plate: 'studio',
    palette: { p1: '#282c27', p2: '#4b5149', p3: '#111311' },
    colorways: [
      { name: 'Ink', hex: '#282c27' },
      { name: 'Bone', hex: '#ddd5c4' }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    soldOut: [],
    material: '17.5 micron merino, 200gsm',
    blurb:
      'A first layer you forget you are wearing. Fine merino, flat seams and a neckline that stays where it is put.',
    specs: [
      '17.5 micron extra-fine merino',
      'Flatlock seams throughout',
      'Thumb loops at the cuff',
      'mulesing-free, traceable flock'
    ],
    fit: 'Close to the body with stretch. True to size.',
    care: 'Wash cold on wool cycle. Dry flat, away from heat.',
    twin: { name: 'Base Layer Digital Study', price: 20 }
  },
  {
    slug: 'field-cap',
    name: 'Field Cap',
    category: 'Accessories',
    kind: 'physical',
    price: 75,
    plate: 'ridge',
    palette: { p1: '#3d4235', p2: '#6d735f', p3: '#181a15' },
    colorways: [
      { name: 'Olive', hex: '#3d4235' },
      { name: 'Charcoal', hex: '#3a3a37' }
    ],
    sizes: ['One size'],
    soldOut: [],
    material: 'Waxed British cotton',
    blurb:
      'A five-panel cap in waxed cotton that takes on weather instead of fighting it. Soft brim, leather adjuster, no logo.',
    specs: [
      'Waxed 8oz British cotton',
      'Soft, packable brim',
      'Leather strap with a brass buckle',
      'Unlined for breathability'
    ],
    fit: 'One size, adjustable 54–60cm.',
    care: 'Spot clean only. Re-wax annually with a neutral wax.',
    twin: { name: 'Field Cap Digital Study', price: 15 }
  },
  {
    slug: 'contour-short',
    name: 'Contour Short',
    category: 'Trousers',
    kind: 'physical',
    price: 165,
    plate: 'dune',
    palette: { p1: '#5b5a4d', p2: '#8f8b78', p3: '#2a2b24' },
    colorways: [
      { name: 'Stone', hex: '#8f8b78' },
      { name: 'Ink', hex: '#2a2b24' }
    ],
    sizes: ['28', '30', '32', '34', '36'],
    soldOut: [],
    material: 'Dry-touch nylon cotton',
    blurb:
      'Cut above the knee with a drawcord hem that can be tightened for ascent or left open for descent.',
    specs: [
      'Nylon-cotton blend with a dry hand',
      'Elasticated waist with an internal drawcord',
      'Zipped rear pocket',
      '7-inch inseam'
    ],
    fit: 'Relaxed, mid rise, sitting above the knee.',
    care: 'Machine wash cold. Line dry.',
    twin: { name: 'Contour Digital Study', price: 20 }
  },
  {
    slug: 'terra-sling',
    name: 'Terra Sling',
    category: 'Accessories',
    kind: 'physical',
    price: 130,
    plate: 'fog',
    palette: { p1: '#2f3229', p2: '#5f6252', p3: '#14150f' },
    colorways: [
      { name: 'Forest', hex: '#2f3229' },
      { name: 'Stone', hex: '#8a8574' }
    ],
    sizes: ['One size'],
    soldOut: [],
    material: 'Recycled ripstop, 210D',
    blurb:
      'A close-body sling for the things that matter: phone, keys, a folded shell. Sits flat under a jacket.',
    specs: [
      '210D recycled ripstop, PU backed',
      'Two-way zip with a webbing pull',
      'Padded rear panel and mesh back',
      'Adjustable 25–48cm strap'
    ],
    fit: 'Wear across the body or at the waist.',
    care: 'Wipe clean with a damp cloth.',
    twin: { name: 'Terra Digital Study', price: 18 }
  },

  /* ---------------- digital only ---------------- */
  {
    slug: 'digital-cirque',
    name: 'The Digital Cirque',
    category: 'Digital',
    kind: 'digital',
    price: 45,
    plate: 'wire',
    palette: { p1: '#1d2a22', p2: '#3e6a52', p3: '#0b0f0c' },
    colorways: [{ name: 'Forest', hex: '#3e6a52' }],
    sizes: ['CLO 3D', 'OBJ + FBX'],
    soldOut: [],
    material: '3D garment asset, rig-ready',
    blurb:
      'The Cirque Trouser as a finished 3D asset. Modelled in CLO, retopologised for animation, with two fabric presets included.',
    specs: [
      'CLO 3D project + OBJ/FBX export',
      'Retopologised mesh, under 28k tris',
      'Two fabric presets: dry wool, coated wool',
      'PBR textures at 2K, .png'
    ],
    fit: 'Fits standard humanoid avatars. Includes a scaling guide.',
    care: 'Licence: personal and editorial use. No resale of the file.',
    format: 'Instant download after purchase. A licence key arrives by email.'
  },
  {
    slug: 'terrain-skin-01',
    name: 'Terrain Skin 01',
    category: 'Digital',
    kind: 'digital',
    price: 30,
    plate: 'wire',
    palette: { p1: '#22261f', p2: '#6a7358', p3: '#0c0f0a' },
    colorways: [{ name: 'Moss', hex: '#6a7358' }],
    sizes: ['4K', '2K'],
    soldOut: [],
    material: 'Shader + texture set',
    blurb:
      'A surface study drawn from the textures of the site: lichen, wet stone, dry grass. Applied to any mesh in the digital wardrobe.',
    specs: [
      '4K and 2K texture sets, tileable',
      'Arnold and Blender Cycles shaders',
      'Roughness, normal, albedo, AO maps',
      'Six surface variants'
    ],
    fit: 'Compatible with the Digital Cirque and Ridgeline assets.',
    care: 'Licence: personal and editorial use.',
    format: 'Instant download after purchase.'
  },
  {
    slug: 'digital-ridgeline',
    name: 'The Digital Ridgeline',
    category: 'Digital',
    kind: 'digital',
    price: 55,
    plate: 'wire',
    palette: { p1: '#1b2a24', p2: '#376b58', p3: '#090f0c' },
    colorways: [{ name: 'Forest', hex: '#376b58' }],
    sizes: ['CLO 3D', 'USD + GLB'],
    soldOut: [],
    material: '3D shell asset, sim-ready',
    blurb:
      'The Ridgeline Shell as a simulation-ready asset, with a hood rig and layered panels for cloth sim.',
    specs: [
      'CLO 3D project + USD/GLB export',
      'Separate panels for cloth simulation',
      'Hood rig with two poses',
      'Includes the digital look turntable'
    ],
    fit: 'Standard humanoid avatars, S–XL graded.',
    care: 'Licence: personal and editorial use.',
    format: 'Instant download after purchase.'
  },
  {
    slug: 'lookbook-vol-01',
    name: 'Lookbook Vol. 01',
    category: 'Digital',
    kind: 'digital',
    price: 15,
    plate: 'wire',
    palette: { p1: '#242520', p2: '#565a4c', p3: '#0d0e0b' },
    colorways: [{ name: 'Terrain', hex: '#565a4c' }],
    sizes: ['PDF', 'EPUB'],
    soldOut: [],
    material: '96-page digital edition',
    blurb:
      'The first season, documented. Studio plates, terrain studies and the notes behind each cut, in a single quiet PDF.',
    specs: [
      '96 pages, 2 editions (PDF, EPUB)',
      'Studio and location plates',
      'Pattern and material notes',
      'Reads on any device'
    ],
    fit: 'Digital edition only. No physical counterpart.',
    care: 'Licence: personal use.',
    format: 'Instant download after purchase.'
  }
];

const CATALOG_BY_SLUG = Object.fromEntries(CATALOG.map((p) => [p.slug, p]));

const DIGITAL = CATALOG.filter((p) => p.kind === 'digital');
const PHYSICAL = CATALOG.filter((p) => p.kind === 'physical');

function money(value) {
  return '£' + Number(value).toLocaleString('en-GB');
}
