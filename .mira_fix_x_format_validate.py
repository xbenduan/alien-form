from pathlib import Path

form_path = Path('packages/core/src/form.ts')
form = form_path.read_text()
old = """  createField(path: string, schema: IFieldSchema, initialValue?: any): IField {\n    const rawInitVal = initialValue !== undefined ? initialValue : getDeepValue(this._initialValues, path)\n    const initVal = this._formatInitialValue(path, schema, rawInitVal)\n    const field = new Field(path, schema, initVal)\n"""
new = """  createField(path: string, schema: IFieldSchema, initialValue?: any): IField {\n    const rawInitVal = initialValue !== undefined ? initialValue : getDeepValue(this._initialValues, path)\n    const sourceInitVal = rawInitVal !== undefined ? rawInitVal : schema.default\n    const initVal = this._formatInitialValue(path, schema, sourceInitVal)\n    const fieldSchema = rawInitVal === undefined && schema.default !== undefined ? { ...schema, default: undefined } : schema\n    const field = new Field(path, fieldSchema, initVal)\n"""
if old not in form:
    raise SystemExit('createField snippet not found')
form = form.replace(old, new)
old = """  async _runXValidate(field: IField, rules: SchemaXValidate, value: any): Promise<FieldError[]> {\n    const resolved = await this._runXRuleListAsync(field, 'validate', rules, this._buildValueScope(value, field), 'x-validate', value)\n    return normalizeValidationErrors(resolved)\n  }\n"""
new = """  async _runXValidate(field: IField, rules: SchemaXValidate, value: any): Promise<FieldError[]> {\n    const ruleList = Array.isArray(rules) ? rules : [rules]\n    const errors: FieldError[] = []\n    for (const rule of ruleList) {\n      const resolved = await this._resolveXRuleValue(\n        field,\n        'validate',\n        rule,\n        this._buildValueScope(value, field),\n        'x-validate'\n      )\n      errors.push(...normalizeValidationErrors(resolved))\n    }\n    return errors\n  }\n"""
if old not in form:
    raise SystemExit('_runXValidate snippet not found')
form = form.replace(old, new)
form_path.write_text(form)

test_path = Path('packages/core/src/__tests__/core.test.ts')
test = test_path.read_text()
anchor = """  it('supports computed x-format handlers and x-validate rules', async () => {\n"""
insert = """  it('formats schema default values with x-format input', async () => {\n    const form = createForm()\n    form.setSchema({\n      type: 'object',\n      properties: {\n        amount: {\n          type: 'number',\n          default: 12345,\n          'x-format': {\n            input: {\n              type: 'expression',\n              expression: '$value / 100',\n            },\n            output: {\n              type: 'expression',\n              expression: '$value * 100',\n            },\n          },\n        },\n      },\n    })\n\n    expect(form.getField('amount')?.value).toBe(123.45)\n    expect(form.values).toEqual({ amount: 12345 })\n    await expect(form.submit()).resolves.toEqual({ amount: 12345 })\n  })\n\n  it('treats undefined x-validate expression result as passed', async () => {\n    const form = createForm()\n    form.setSchema({\n      type: 'object',\n      properties: {\n        username: {\n          type: 'string',\n          default: 'admin',\n          'x-validate': {\n            type: 'expression',\n            expression: \"$value === 'admin' ? undefined : 'Username must be admin'\",\n          },\n        },\n      },\n    })\n\n    await expect(form.validate()).resolves.toBe(true)\n    expect(form.errors).toEqual([])\n\n    form.getField('username')?.setValue('guest')\n    await expect(form.validate()).resolves.toBe(false)\n    expect(form.errors).toEqual([{ message: 'Username must be admin', type: 'x-validate' }])\n  })\n\n"""
if anchor not in test:
    raise SystemExit('test anchor not found')
test = test.replace(anchor, insert + anchor, 1)
test_path.write_text(test)
