import {expect} from '@playwright/test'
import {Page} from 'playwright'

type PredicateSpec = {
  questionName: string
  action?: string | null
  scalar: string
  operator: string
  value?: string
  values?: string[]
}

export class AdminPredicates {
  public page!: Page

  constructor(page: Page) {
    this.page = page
  }

  async addValueRows(count: number) {
    for (let i = 0; i < count; i++) {
      await this.page.click('#predicate-add-value-row')
    }
  }

  async clickEditPredicateButton(predicateType: 'visibility' | 'eligibility') {
    await this.page.click(
      `button:has-text("Edit existing ${predicateType} condition")`,
    )
  }

  async clickRemovePredicateButton(
    predicateType: 'visibility' | 'eligibility',
  ) {
    await this.page.click(
      `button:has-text("Remove existing ${predicateType} condition")`,
    )
  }

  async addPredicates(...predicateSpecs: PredicateSpec[]) {
    for (const predicateSpec of predicateSpecs) {
      await this.selectQuestionForPredicate(predicateSpec.questionName)
    }

    await this.clickAddConditionButton()
    const totalRowsNeeded = predicateSpecs[0]?.values?.length ?? 0
    await this.addValueRows(Math.max(totalRowsNeeded - 1, 0))

    for (const predicateSpec of predicateSpecs) {
      await this.configurePredicate(predicateSpec)
    }

    await this.clickSaveConditionButton()
  }

  async selectQuestionForPredicate(questionName: string) {
    await this.page.click(`label:has-text("Admin ID: ${questionName}")`)
  }

  async clickAddConditionButton() {
    await this.page.click('button:has-text("Add condition")')
  }

  async clickSaveConditionButton() {
    await this.page.click('button:visible:has-text("Save condition")')
  }

  async expectPredicateErrorToast(type: string) {
    const toastMessages = await this.page.innerText('#toast-container')
    expect(toastMessages).toContain(`One or more ${type} is missing`)
  }

  async getQuestionId(questionName: string): Promise<string> {
    const questionNameField = this.page.getByTestId(questionName)
    expect((await questionNameField.all()).length).toEqual(1)

    const questionId = await questionNameField.getAttribute('data-question-id')
    expect(questionId).not.toBeNull()

    return questionId as string
  }

  async configurePredicate({
    questionName,
    action,
    scalar,
    operator,
    value,
    values,
  }: PredicateSpec) {
    values = values ? values : value ? [value] : []

    const questionId = await this.getQuestionId(questionName)

    if (action != null) {
      await this.page.selectOption(`.cf-predicate-action select`, {
        label: action,
      })
    }
    await this.page.selectOption(
      `.cf-scalar-select[data-question-id="${questionId}"] select`,
      {
        label: scalar,
      },
    )
    await this.page.selectOption(
      `.cf-operator-select[data-question-id="${questionId}"] select`,
      {
        label: operator,
      },
    )

    let groupNum = 1
    for (const valueToSet of values) {
      // Service areas are the only value input that use a select
      if (scalar === 'service_area') {
        const valueSelect = await this.page.$(
          `select[name="group-${groupNum++}-question-${questionId}-predicateValue"]`,
        )

        if (valueSelect == null) {
          throw new Error(
            `Unable to find select for service area: select[name="group-${groupNum++}-question-${questionId}-predicateValue"]`,
          )
        }

        await valueSelect.selectOption({label: valueToSet})
        continue
      }

      const valueInput = await this.page.$(
        `input[name="group-${groupNum++}-question-${questionId}-predicateValue"]`,
      )

      if (valueInput) {
        await valueInput.fill(valueToSet || '')
      } else {
        // We have a checkbox for the value.
        const valueArray = valueToSet.split(',')
        for (const value of valueArray) {
          await this.page.check(`label:has-text("${value}")`)
        }
      }
    }
  }

  async expectPredicateDisplayTextContains(condition: string) {
    expect(await this.page.innerText('.cf-display-predicate')).toContain(
      condition,
    )
  }
}
