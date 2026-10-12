-- FICTIONAL DEVELOPMENT DATA, not a client protocol or a production account setup.
-- Run explicitly on an empty migrated development database, once; repeated execution fails.
-- No authentication identity or password is created. Backend authentication remains required.
BEGIN;
INSERT INTO app_user(id,display_name) VALUES
 ('00000000-0000-4000-8000-000000000901','Demo admin — fictional'),
 ('00000000-0000-4000-8000-000000000902','Demo researcher — fictional');
INSERT INTO app_user_role(user_id,role_id) VALUES
 ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000011'),
 ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000012'),
 ('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000012');
INSERT INTO equipment(id,code,name) VALUES
 ('00000000-0000-4000-8000-000000000801','MACHINE-DEMO-001','Machine de démonstration — fictive');
INSERT INTO resource_group(id,code,label) VALUES
 ('00000000-0000-4000-8000-000000000101','MATERIALS-DEMO','Matériaux — démonstration');
INSERT INTO reference_resource(id,kind,code,label) VALUES
 ('00000000-0000-4000-8000-000000000201','material','AU','Or — démonstration');
INSERT INTO resource_group_member(group_id,resource_id,position) VALUES
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',1);
INSERT INTO unit(id,code,symbol,label,dimension) VALUES
 ('00000000-0000-4000-8000-000000000301','g','g','Gramme','mass');
INSERT INTO form_template(id,equipment_id,created_by_user_id,name) VALUES
 ('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000901','Dépôt multicouche — démonstration');
INSERT INTO template_version(id,template_id,version_no,created_by_user_id,definition) VALUES
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000701',1,
  '00000000-0000-4000-8000-000000000901',
  $definition${
  "schema_format": 1,
  "title": "Dépôt multicouche — démonstration",
  "nodes": [
    {
      "id": "i_intro",
      "type": "instruction",
      "text": "Renseigner les paramètres de chaque couche."
    },
    {
      "id": "f_mode",
      "type": "select",
      "label": "Mode",
      "required": true,
      "options": [
        {
          "id": "standard",
          "label": "Standard"
        },
        {
          "id": "multilayer",
          "label": "Multicouche"
        }
      ]
    },
    {
      "id": "g_layers",
      "type": "group",
      "label": "Paramètres des couches",
      "visible_when": {
        "field_id": "f_mode",
        "operator": "eq",
        "value": "multilayer",
        "scope": "root"
      },
      "children": [
        {
          "id": "f_count",
          "type": "integer",
          "label": "Nombre de couches",
          "required": true,
          "min": 1,
          "max": 10
        },
        {
          "id": "r_layers",
          "type": "repeat",
          "label": "Couches",
          "count_from": "f_count",
          "max_items": 10,
          "children": [
            {
              "id": "f_material",
              "type": "resource_select",
              "label": "Matériau",
              "required": true,
              "group_id": "00000000-0000-4000-8000-000000000101"
            },
            {
              "id": "f_mass",
              "type": "quantity",
              "label": "Masse",
              "required": true,
              "dimension": "mass",
              "allowed_unit_ids": [
                "00000000-0000-4000-8000-000000000301"
              ]
            }
          ]
        }
      ]
    }
  ]
}$definition$::jsonb);
INSERT INTO submission(id,template_version_id,created_by_user_id,project_reference,sample_reference,answers) VALUES
 ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000902','PROJET-DEMO-001','ECHANTILLON-DEMO-001',
  $answers${
  "f_mode": "multilayer",
  "f_count": 3,
  "r_layers": [
    {
      "instance_id": "00000000-0000-4000-8000-000000000401",
      "answers": {
        "f_material": {
          "resource_id": "00000000-0000-4000-8000-000000000201"
        },
        "f_mass": {
          "value": "1.2",
          "unit_id": "00000000-0000-4000-8000-000000000301"
        }
      }
    },
    {
      "instance_id": "00000000-0000-4000-8000-000000000402",
      "answers": {
        "f_material": {
          "resource_id": "00000000-0000-4000-8000-000000000201"
        },
        "f_mass": {
          "value": "0.8",
          "unit_id": "00000000-0000-4000-8000-000000000301"
        }
      }
    },
    {
      "instance_id": "00000000-0000-4000-8000-000000000403",
      "answers": {
        "f_material": {
          "resource_id": "00000000-0000-4000-8000-000000000201"
        },
        "f_mass": {
          "value": "1.0",
          "unit_id": "00000000-0000-4000-8000-000000000301"
        }
      }
    }
  ]
}$answers$::jsonb);
INSERT INTO experiment(id,created_by_user_id,title) VALUES
 ('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000902','Expérience de démonstration — fictive');
INSERT INTO experiment_step(id,experiment_id,template_version_id,submission_id,position) VALUES
 ('00000000-0000-4000-8000-000000000511','00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000601',1);
COMMIT;
-- The submission intentionally remains a draft, with three retained repeat instances.
-- Finalization must be implemented through the validated backend transaction, not by a UI SQL call.
