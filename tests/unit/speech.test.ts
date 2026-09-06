import { describe, expect, it } from 'vitest';
import { estimateReadingMs, speakableText, splitSentences } from '../../src/lib/domain/speech';

describe('speakableText', () => {
  it('replaces formulas with a spoken word and strips Markdown', () => {
    const md =
      '## Titre\n\nLa **dérivée** de $x^2$ est $$2x$$ : voir [la leçon](/concept/x).\n- un\n- deux';
    expect(speakableText(md)).toBe(
      'Titre La dérivée de formule est formule : voir la leçon. un deux'
    );
    expect(speakableText(md, 'en')).toContain('formula');
  });

  it('keeps plain prose untouched apart from whitespace', () => {
    expect(speakableText("  L'exponentielle est partout.\n\nUne seule équation. ")).toBe(
      "L'exponentielle est partout. Une seule équation."
    );
    expect(speakableText(undefined)).toBe('');
  });

  it('keeps underscores inside identifiers and emphasis markers out', () => {
    expect(speakableText('route_first et *italique* et __gras__')).toBe(
      'route_first et italique et gras'
    );
  });
});

describe('splitSentences', () => {
  it('splits on sentence ends and glues fragments that cannot stand alone', () => {
    expect(splitSentences('Padoue, vers 1604. Vous prédisez ! Puis vous mesurez ? Fin.')).toEqual([
      'Padoue, vers 1604.',
      'Vous prédisez !',
      'Puis vous mesurez ?',
      'Fin.',
    ]);
    expect(splitSentences('Voir M. Galilei. Ensuite la loi.')).toEqual([
      'Voir M. Galilei.',
      'Ensuite la loi.',
    ]);
    expect(splitSentences('')).toEqual([]);
  });
});

describe('estimateReadingMs', () => {
  it('never goes below four seconds and grows with the text', () => {
    expect(estimateReadingMs('')).toBe(4000);
    expect(estimateReadingMs('Trois petits mots.')).toBe(4000);
    const long = Array.from({ length: 170 }, () => 'mot').join(' ');
    expect(estimateReadingMs(long)).toBe(60_800);
  });
});

describe('sentences of a lesson', () => {
  it('ends a sentence on a lower-case variable but glues a capitalised abbreviation', () => {
    expect(
      splitSentences('Prenons f de x égale x carré moins deux x. Pour x égal 3, l’image vaut 3.')
    ).toHaveLength(2);
    expect(splitSentences('Voici M. Galilei. Il mesure.')).toEqual([
      'Voici M. Galilei.',
      'Il mesure.',
    ]);
    expect(
      splitSentences('C’est le nombre e. En chaque point, la pente vaut la hauteur.')
    ).toHaveLength(2);
  });
});
