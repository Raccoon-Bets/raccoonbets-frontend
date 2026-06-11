import type { Locator, Page } from '@playwright/test'

export class GroupsNewPage {
  constructor(private readonly page: Page) {}

  async visit(): Promise<this> {
    await this.page.goto('/groups/new')
    return this
  }

  async fillName(name: string): Promise<void> {
    await this.page.getByTestId('group-name').fill(name)
  }

  async fillSubdomain(subdomain: string): Promise<void> {
    await this.page.getByTestId('group-subdomain').fill(subdomain)
  }

  async selectCurrency(currency: string): Promise<void> {
    await this.page.getByTestId('group-currency').click()
    await this.page.getByRole('option', { name: currency }).click()
  }

  availability(): Locator {
    return this.page.getByTestId('subdomain-availability')
  }

  async submit(): Promise<void> {
    await this.page.getByTestId('group-submit').click()
  }
}
