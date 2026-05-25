import { Instrument, ResponseScale } from '../types';
import { registerInstrument } from '../index';
import { atecStrategy } from './scoring';

/**
 * ATEC uses a 0-3 scale for subscales 1 & 4, and 0-2 for subscales 2 & 3.
 * We model the full range as a 4-point scale (0-3) and restrict subscales 2 & 3
 * via allowedValues: ['0', '1', '2'].
 */
const ATEC_SCALE: ResponseScale = {
  id: 'atec-4pt',
  options: [
    { value: '0', label: '0', numeric: 0 },
    { value: '1', label: '1', numeric: 1 },
    { value: '2', label: '2', numeric: 2 },
    { value: '3', label: '3', numeric: 3 },
  ],
};

const atecInstrument: Instrument = {
  id: 'atec',
  name: 'ATEC — Autism Treatment Evaluation Checklist',
  shortName: 'ATEC',
  ageRange: '0+',
  scale: ATEC_SCALE,
  sections: [
    {
      key: 'fala',
      label: 'Fala/Linguagem/Comunicação',
      // Items 2001-2014 (14 items, 0-3 scale)
      itemIds: [
        2001, 2002, 2003, 2004, 2005, 2006, 2007,
        2008, 2009, 2010, 2011, 2012, 2013, 2014,
      ],
    },
    {
      key: 'sociabilidade',
      label: 'Sociabilidade',
      // Items 2015-2034 (20 items, 0-2 scale)
      itemIds: [
        2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
        2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034,
      ],
      allowedValues: ['0', '1', '2'],
    },
    {
      key: 'conscienciaSensorial',
      label: 'Consciência Sensorial/Cognitiva',
      // Items 2035-2052 (18 items, 0-2 scale)
      itemIds: [
        2035, 2036, 2037, 2038, 2039, 2040, 2041, 2042, 2043, 2044,
        2045, 2046, 2047, 2048, 2049, 2050, 2051, 2052,
      ],
      allowedValues: ['0', '1', '2'],
    },
    {
      key: 'saudeComportamento',
      label: 'Saúde/Comportamento Físico',
      // Items 2053-2077 (25 items, 0-3 scale)
      itemIds: [
        2053, 2054, 2055, 2056, 2057, 2058, 2059, 2060, 2061, 2062, 2063,
        2064, 2065, 2066, 2067, 2068, 2069, 2070, 2071, 2072, 2073, 2074,
        2075, 2076, 2077,
      ],
    },
  ],
  scoringStrategy: atecStrategy,
};

registerInstrument(atecInstrument);
