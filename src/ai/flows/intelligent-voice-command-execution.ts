'use server';
/**
 * @fileOverview An AI agent that interprets natural language commands into executable shell commands or system actions.
 *
 * - intelligentVoiceCommandExecution - A function that handles the interpretation of a voice command.
 * - IntelligentVoiceCommandExecutionInput - The input type for the intelligentVoiceCommandExecution function.
 * - IntelligentVoiceCommandExecutionOutput - The return type for the intelligentVoiceCommandExecution function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentVoiceCommandExecutionInputSchema = z.object({
  command: z.string().describe('The natural language command from the user.'),
});
export type IntelligentVoiceCommandExecutionInput = z.infer<
  typeof IntelligentVoiceCommandExecutionInputSchema
>;

const IntelligentVoiceCommandExecutionOutputSchema = z.object({
  actionType: z
    .enum(['shell_command', 'system_action'])
    .describe('The type of action to perform.'),
  command: z
    .string()
    .describe('The shell command or system action to execute.'),
  context: z
    .string()
    .optional()
    .describe('Additional context or explanation for the action.'),
});
export type IntelligentVoiceCommandExecutionOutput = z.infer<
  typeof IntelligentVoiceCommandExecutionOutputSchema
>;

export async function intelligentVoiceCommandExecution(
  input: IntelligentVoiceCommandExecutionInput
): Promise<IntelligentVoiceCommandExecutionOutput> {
  return intelligentVoiceCommandExecutionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentVoiceCommandExecutionPrompt',
  input: {schema: IntelligentVoiceCommandExecutionInputSchema},
  output: {schema: IntelligentVoiceCommandExecutionOutputSchema},
  prompt: `You are an AI assistant designed to interpret natural language commands into executable system actions or shell commands for a smart device.
When a user provides a command, you will analyze it and generate a JSON object with three fields: 'actionType', 'command', and optionally 'context'.
The 'actionType' should be either 'shell_command' if it's a command executable in a terminal (like Termux), or 'system_action' if it refers to a device-level function (like changing settings, making calls, opening apps, etc., which might require a specific API or deep-link call).
The 'command' field should contain the specific shell command or a descriptive identifier for the system action, including any necessary parameters in a clear, concise format (e.g., function(param1, param2)).
If you need to make a reasonable assumption (e.g., about default values or a common tool), provide it in the 'context' field.

Here are some examples:

User: Open the downloads folder
Output:
{
  "actionType": "shell_command",
  "command": "cd ~/storage/downloads"
}

User: Set a timer for 5 minutes
Output:
{
  "actionType": "system_action",
  "command": "set_timer(300)"
}

User: Call Mom
Output:
{
  "actionType": "system_action",
  "command": "initiate_call('Mom')",
  "context": "Assuming 'Mom' is a recognized contact."
}

User: What's the weather like?
Output:
{
  "actionType": "system_action",
  "command": "get_weather_current_location()"
}

User: Increase screen brightness
Output:
{
  "actionType": "system_action",
  "command": "adjust_brightness(increase=true, value=20)"
}

User: Delete temporary files
Output:
{
  "actionType": "shell_command",
  "command": "rm -rf /data/local/tmp/*",
  "context": "This assumes a Linux/Android environment and specific temporary directory path."
}

User: Open Termux
Output:
{
  "actionType": "system_action",
  "command": "open_app('Termux')"
}

User: Change phone setting for Wi-Fi to off
Output:
{
  "actionType": "system_action",
  "command": "toggle_wifi(state=false)"
}

User: {{command}}`,
});

const intelligentVoiceCommandExecutionFlow = ai.defineFlow(
  {
    name: 'intelligentVoiceCommandExecutionFlow',
    inputSchema: IntelligentVoiceCommandExecutionInputSchema,
    outputSchema: IntelligentVoiceCommandExecutionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
