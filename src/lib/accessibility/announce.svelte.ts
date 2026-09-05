class Announcer {
  message = $state('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Announces a message through the global polite live region. */
  say(text: string): void {
    this.message = '';
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.message = text), 30);
  }
}

export const announcer = new Announcer();
