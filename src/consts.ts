export const predefinedLangs: string[] = [
  '2002',
  'en-pt-BR', 'zamenhofo', 'ile', 'ina', 'toki', 'ktv-eng', 'ldp',
  'loglan',
];

export const langs: string[] = [
  'en',
  'jbo',
  'ja',
  'ru',
  'es',
  'fr',
  'pl',
  'de',
  'eo',
  'zh',
  'en-simple',
  'fr-facile',
  'hu',
  'sv',
  'tok'
];

export const bais = {
  en: {
    initial: "^(|na'e |je'a |to'e )([a-z']+) modal,",
    replacement: '$1{$2} modal,',
    processed: "^(|na'e |je'a |to'e )\\{([a-z']+)\\} modal,",
  },
  es: {
    initial: "^(|na'e |je'a |to'e )([a-z']+) modal,",
    replacement: '$1{$2} modal,',
    processed: "^(|na'e |je'a |to'e )\\{([a-z']+)\\} modal,",
  },
  jbo: {
    initial: "^fi'o (|na'e |je'a |to'e )([a-z']+)$",
    replacement: "fi'o $1{$2}",
    processed: "^fi'o (|na'e |je'a |to'e )\\{([a-z']+)\\}",
  },
  ru: {
    initial: "^модальный предлог от (|na'e |je'a |to'e )([a-z']+),",
    replacement: 'модальный предлог от $1{$2},',
    processed: "^модальный предлог от (|na'e |je'a |to'e )\\{([a-z']+)\\},",
  },
};

export const scales = {
  en: {
    UI: {
      selmaho: '^(UI)[0-9a-z\\*\\+]*$',
      match: '^(attitudinal[^:]*|discursive): ',
    },
    COI: {
      selmaho: '^(COI)[0-9a-z\\*\\+]*$',
      match: '^vocative: ',
    },
  },
  es: {
    UI: {
      selmaho: '^(UI)[0-9a-z\\*\\+]*$',
      match: '^(modificador de actitudinal|actitudinal[^:]*|discursivo): ',
    },
    COI: {
      selmaho: '^(COI)[0-9a-z\\*\\+]*$',
      match: '^vocativo: ',
    },
  },
  jbo: {
    UI: {
      selmaho: '^(UI)[0-9a-z\\*\\+]*$',
      match: '^(attitudinal[^:]*|discursive): ',
    },
    COI: {
      selmaho: '^(COI)[0-9a-z\\*\\+]*$',
      match: '^vocative: ',
    },
  },
  ru: {
    UI: {
      selmaho: '^(UI)[0-9a-z\\*\\+]*$',
      match: '^(модификатор междометия|междометие[^:]*): ',
    },
    COI: {
      selmaho: '^(COI)[0-9a-z\\*\\+]*$',
      match: '^звательная частица: ',
    },
  },
};
