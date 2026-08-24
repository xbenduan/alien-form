import { MDConstant } from "./MDConstant";
import { MDForm } from "./MDForm";
import { MDService } from "./MDService";
import { MD_UI } from "./MD_UI";
import type { RegisterDescribe } from "./describe";

export class RuntimeCore {
  private static instance: RuntimeCore | undefined;

  readonly ui = new MD_UI();
  readonly service = new MDService();
  readonly constant = new MDConstant();
  readonly form = new MDForm();
  router?: unknown;

  constructor() {
    RuntimeCore.instance = this;
  }

  static get current(): RuntimeCore {
    if (!RuntimeCore.instance) throw new Error("[alien-cms] RuntimeCore 未初始化");
    return RuntimeCore.instance;
  }

  registerGlobal(describe: RegisterDescribe): void {
    this.ui.registerGlobal(describe.ui);
    this.service.registerGlobal(describe.services);
    this.constant.registerGlobal(describe.constant);
    this.form.registerGlobal(describe.form);
  }

  registerDomain(describe: RegisterDescribe, domain: string): void {
    this.ui.registerDomain(domain, describe.ui);
    this.service.registerDomain(domain, describe.services);
    this.constant.registerDomain(domain, describe.constant);
    this.form.registerDomain(domain, describe.form);
  }

  clearDomainRegister(domain: string): void {
    this.ui.clearDomain(domain);
    this.service.clearDomain(domain);
    this.constant.clearDomain(domain);
    this.form.clearDomain(domain);
  }

  scope(domain?: string): Record<string, unknown> {
    return {
      $af_scope_service: (code: string) => this.service.query(code, domain),
      $af_scope_constant: this.constant.all(domain),
      $af_scope_router: this.router,
    };
  }

  resources(domain?: string) {
    return {
      ...this.form.resolve(domain),
      scope: this.scope(domain),
    };
  }
}
