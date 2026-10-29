-- idPrefix 升级为协议必填字段：为存量 HIS 模型回填自增 ID 前缀
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'KS')   WHERE "name" = 'his_department';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'DOC')  WHERE "name" = 'his_doctor';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'SCH')  WHERE "name" = 'his_schedule';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'PAT')  WHERE "name" = 'his_patient';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'REG')  WHERE "name" = 'his_registration';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'MR')   WHERE "name" = 'his_medical_record';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'CI')   WHERE "name" = 'his_charge_item';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'BILL') WHERE "name" = 'his_bill';
UPDATE "models" SET "schema" = json_set("schema", '$.idPrefix', 'RPT')  WHERE "name" = 'his_report';
