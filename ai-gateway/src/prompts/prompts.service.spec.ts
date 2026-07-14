import { PromptsService } from './prompts.service';

/** Unit test for the pure render logic (no DB). */
describe('PromptsService.render', () => {
  const service = new PromptsService({} as never);

  it('interpolates known variables', () => {
    const out = service.render(
      'Assistant for {market}, reply in {lang}.',
      { market: 'Algeria', lang: 'fr' },
    );
    expect(out).toBe('Assistant for Algeria, reply in fr.');
  });

  it('leaves unknown variables as literal placeholders', () => {
    const out = service.render('Hello {name}', {});
    expect(out).toBe('Hello {name}');
  });
});
