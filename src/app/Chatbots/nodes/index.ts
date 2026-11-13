import { FIELDS } from '@app/Chatbots/editor/NodeDrawer';
import { AskFormFields } from '@app/Chatbots/nodes/AskFormFields';
import { AskQuestionFields } from '@app/Chatbots/nodes/AskQuestionFields';
import { ConditionFields } from '@app/Chatbots/nodes/ConditionFields';
import { SendMessageFields } from '@app/Chatbots/nodes/SendMessageFields';
import {
  AddToCrmFields,
  AssignChatFields,
  DoNotContactFields,
  HttpRequestFields,
  JumpFields,
  SendTemplateFields,
  WaitFields,
} from '@app/Chatbots/nodes/SmallFields';
import { UpdateContactFields } from '@app/Chatbots/nodes/UpdateContactFields';

/** Importing this module registers one settings form per node type into the drawer (spec §8.1). */
FIELDS.send_message = SendMessageFields;
FIELDS.send_template = SendTemplateFields;
FIELDS.ask_question = AskQuestionFields;
FIELDS.ask_form = AskFormFields;
FIELDS.condition = ConditionFields;
FIELDS.update_contact = UpdateContactFields;
FIELDS.do_not_contact = DoNotContactFields;
FIELDS.assign_chat = AssignChatFields;
FIELDS.add_to_crm = AddToCrmFields;
FIELDS.http_request = HttpRequestFields;
FIELDS.wait = WaitFields;
FIELDS.jump = JumpFields;

export {};
