import { describe, expect, it } from 'vitest';
import { estimateReadingMs, speakableText, splitSentences } from '../../src/lib/domain/speech';

describe('speakableText', () => {
  it('reads formulas while stripping Markdown', () => {
    const md =
      '## Titre\n\nLa **dérivée** de $x^2$ est $$2x$$ : voir [la leçon](/concept/x).\n- un\n- deux';
    expect(speakableText(md)).toBe(
      'Titre La dérivée de x au carré est 2 x : voir la leçon. un deux'
    );
    expect(speakableText(md, 'en')).toContain('x squared');
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

  it('reads nested lambda applications in both languages without splitting their binders into sentences', () => {
    const source = String.raw`On écrit $\lambda f.\lambda x.f(f(fx))$. Puis on applique.`;
    expect(speakableText(source)).toBe(
      'On écrit lambda f point lambda x point f de f de f de x . Puis on applique.'
    );
    expect(speakableText(source, 'en')).toContain(
      'lambda f period lambda x period f of f of f of x'
    );
    expect(splitSentences(speakableText(source))).toHaveLength(2);
    expect(speakableText('$λf.λx.f(f(fx))$')).toContain('lambda f point lambda x');
  });

  it('keeps numerator, denominator, powers, indices and comparisons in ordinary lessons', () => {
    expect(speakableText(String.raw`$\dfrac{x+1}{x-1}$`)).toBe(
      'fraction avec numérateur x plus 1 et dénominateur x moins 1'
    );
    expect(speakableText('$u_{n+1}=2u_n$')).toBe('u indice n plus 1 égale 2 u indice n');
    expect(speakableText(String.raw`$\sqrt{x+1}$`)).toContain('racine carrée');
    expect(speakableText('$a<b$')).toContain('inférieur');
    expect(speakableText(String.raw`$\int_0^1 x^2\,dx$`)).toContain('l’intégrale de 0 à 1');
    expect(speakableText(String.raw`$\sum_{k=1}^n k$`)).toContain('la somme de k égale 1 à n');
    expect(speakableText(String.raw`$\sum_{k=1}^n k$`, 'en')).toContain('sum from k equals 1 to n');
  });

  it('does not mix languages when the reader switches between French and English', () => {
    expect(speakableText('$x^2$')).toBe('x au carré');
    expect(speakableText('$x^2$', 'en')).toBe('x squared');
    expect(speakableText('$y^2$')).toBe('y au carré');
    expect(speakableText('$y^2$', 'en')).toBe('y squared');
  });

  it('retains malformed notation instead of hiding it or interrupting prose', () => {
    const text = speakableText(String.raw`Avant $\unknown{x}=2$. Après.`);
    expect(text).toContain('x égale 2');
    expect(text).toContain('Après');
    expect(text).not.toContain('formule');
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
