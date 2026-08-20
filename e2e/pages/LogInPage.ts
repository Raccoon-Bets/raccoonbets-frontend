import type { Page } from '@playwright/test'
import { submitAndConfirm } from '../helpers'

export class LogInPage {
  constructor(private readonly page: Page) {}

  async visit(): Promise<this> {
    await this.page.goto('/login')
    return this
  }

  async fillEmail(email: string): Promise<void> {
    await this.page.getByTestId('login-email').fill(email)
  }

  async fillPassword(password: string): Promise<void> {
    await this.page.getByTestId('login-password').fill(password)
  }

  /**
   * Submits the form and waits for `confirmed` to observe the outcome, re-clicking if a
   * Turnstile token re-issue swallowed the click.
   *
   * @param confirmed synchronizes on the result, whether that is a session or a rejection
   */
  async submit(confirmed: () => Promise<void>): Promise<void> {
    await submitAndConfirm(this.page.getByTestId('login-submit'), confirmed)
  }

  async logIn(email: string, password: string, confirmed: () => Promise<void>): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.submit(confirmed)
  }
}
