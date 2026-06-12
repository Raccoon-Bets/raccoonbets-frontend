import type { Page } from '@playwright/test'
import { clickTurnstileSubmit } from '../helpers'

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

  async submit(): Promise<void> {
    await clickTurnstileSubmit(this.page.getByTestId('signup-submit'))
  }
}
