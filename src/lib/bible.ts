export type TranslationCode = 'KJV' | 'NIV' | 'ESV' | 'LSG' | 'S21';

export type ScripturePassage = {
  reference: string;
  translation: TranslationCode;
  translationName: string;
  text: string;
};

const SAMPLE_PASSAGES: Record<string, Record<string, string>> = {
  'John 15:1-5': {
    KJV: '1 I am the true vine, and my Father is the husbandman. 2 Every branch in me that beareth not fruit he taketh away: and every branch that beareth fruit, he purgeth it, that it may bring forth more fruit. 3 Now ye are clean through the word which I have spoken unto you. 4 Abide in me, and I in you. As the branch cannot bear fruit of itself, except it abide in the vine; no more can ye, except ye abide in me. 5 I am the vine, ye are the branches: He that abadeth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.',
    NIV: '1 "I am the true vine, and my Father is the gardener. 2 He cuts off every branch in me that bears no fruit, while every branch that does bear fruit he prunes so that it will be even more fruitful. 3 You are already clean because of the word I have spoken to you. 4 Remain in me, as I also remain in you. No branch can bear fruit by itself; it must remain in the vine. Neither can you bear fruit unless you remain in me. 5 I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing."',
    LSG: '1 Je suis le vrai cep, et mon Père est le vigneron. 2 Tout sarment qui est en moi et qui ne porte pas de fruit, il le retranche; et tout sarment qui porte du fruit, il l’émonde, afin qu’il porte encore plus de fruit. 3 Déjà vous êtes purs, à cause de la parole que je vous ai annoncée. 4 Demeurez en moi, et je demeurerai en vous. Comme le sarment ne peut de lui-même porter du fruit, s’il ne demeure attaché au cep, ainsi vous ne le pouvez non plus, si vous ne demeurez en moi. 5 Je suis le cep, vous êtes les sarments. Celui qui demeure en moi et en qui je demeure porte beaucoup de fruit, car sans moi vous ne pouvez rien faire.',
  },
};

export function getTranslationName(code: TranslationCode): string {
  switch (code) {
    case 'KJV': return 'King James Version';
    case 'NIV': return 'New International Version';
    case 'ESV': return 'English Standard Version';
    case 'LSG': return 'Louis Segond 1910';
    case 'S21': return 'Segond 21';
    default: return code;
  }
}

export async function fetchScripturePassage(
  reference: string,
  preferredTranslation: TranslationCode = 'NIV',
): Promise<ScripturePassage> {
  const cleanRef = reference.trim();
  const known = SAMPLE_PASSAGES[cleanRef];

  if (known && known[preferredTranslation]) {
    return {
      reference: cleanRef,
      translation: preferredTranslation,
      translationName: getTranslationName(preferredTranslation),
      text: known[preferredTranslation],
    };
  }

  // Fallback API lookup using Bible API
  try {
    const formattedRef = encodeURIComponent(cleanRef);
    const response = await fetch(`https://bible-api.com/${formattedRef}`);
    if (response.ok) {
      const data = await response.json();
      if (data.text) {
        return {
          reference: data.reference ?? cleanRef,
          translation: preferredTranslation,
          translationName: getTranslationName(preferredTranslation),
          text: data.text.trim().replace(/\n+/g, ' '),
        };
      }
    }
  } catch {
    // Ignore fetch error and return default text fallback
  }

  return {
    reference: cleanRef,
    translation: preferredTranslation,
    translationName: getTranslationName(preferredTranslation),
    text: `"${cleanRef}" — Let the word of Christ dwell in you richly in all wisdom, teaching and admonishing one another in psalms and hymns and spiritual songs. (Colossians 3:16)`,
  };
}
