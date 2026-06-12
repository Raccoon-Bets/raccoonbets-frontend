import type { Page } from '@playwright/test'
import { clickTurnstileSubmit } from '../helpers'

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

  async submit(): Promise<void> {
    await clickTurnstileSubmit(this.page.getByTestId('login-submit'))
  }

  async logIn(email: string, password: string): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.submit()
  }
}
