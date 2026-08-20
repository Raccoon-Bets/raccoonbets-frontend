import type { Page } from '@playwright/test'
import { submitAndConfirm } from '../helpers'

export class SignUpPage {
  constructor(private readonly page: Page) {}

  async visit(): Promise<this> {
    await this.page.goto('/signup')
    return this
  }

  async fillName(name: string): Promise<void> {
    await this.page.getByTestId('signup-name').fill(name)
  }

  async fillEmail(email: string): Promise<void> {
    await this.page.getByTestId('signup-email').fill(email)
  }

  async fillPassword(password: string): Promise<void> {
    await this.page.getByTestId('signup-password').fill(password)
  }

  /**
   * Submits the form and waits for `confirmed` to observe the outcome, re-clicking if a
   * Turnstile token re-issue swallowed the click.
   *
   * @param confirmed synchronizes on the result, whether that is success or a rejection
   */
  async submit(confirmed: () => Promise<void>): Promise<void> {
    await submitAndConfirm(this.page.getByTestId('signup-submit'), confirmed)
  }
}
