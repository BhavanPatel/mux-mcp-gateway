/**
 * AddServer view — multi-step form for manually adding a server.
 * Step 1: Name, Step 2: Transport (HTTP/Stdio), Step 3: URL or Command.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';

interface AddServerProps {
  onBack: () => void;
  onAdd: (
    name: string,
    config: { transport: 'http' | 'stdio'; url?: string; command?: string; args?: string[] },
  ) => void;
}

type Step = 'method' | 'name' | 'transport' | 'details' | 'paste-json' | 'done';

export function AddServer({ onBack, onAdd }: AddServerProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);

  const [step, setStep] = useState<Step>('method');
  const [methodIdx, setMethodIdx] = useState(0);
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<'http' | 'stdio'>('http');
  const [transportIdx, setTransportIdx] = useState(0);
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'method') {
        onBack();
      } else if (step === 'name' || step === 'paste-json') {
        setStep('method');
      } else if (step === 'transport') {
        setStep('name');
      } else if (step === 'details') {
        setStep('transport');
      } else {
        onBack();
      }
      return;
    }

    if (step === 'method') {
      if (key.upArrow || key.downArrow) {
        setMethodIdx((prev) => (prev === 0 ? 1 : 0));
      }
      if (key.return) {
        if (methodIdx === 0) {
          setStep('paste-json');
        } else {
          setStep('name');
        }
      }
      return;
    }

    if (step === 'paste-json') {
      if (key.return && name.trim() && jsonInput.trim()) {
        try {
          const parsed = JSON.parse(jsonInput.trim());
          const isHttp = !!parsed.url || parsed.transport === 'http';
          if (isHttp) {
            onAdd(name.trim(), { transport: 'http', url: parsed.url });
          } else {
            onAdd(name.trim(), { transport: 'stdio', command: parsed.command, args: parsed.args || [] });
          }
          setStep('done');
          setJsonError('');
        } catch {
          setJsonError('Invalid JSON');
        }
        return;
      }
      if (key.backspace || key.delete) {
        if (jsonInput) {
          setJsonInput((prev) => prev.slice(0, -1));
        } else {
          setName((prev) => prev.slice(0, -1));
        }
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        if (!name.trim()) {
          setName((prev) => prev + input);
        } else {
          setJsonInput((prev) => prev + input);
          setJsonError('');
        }
      }
      return;
    }

    if (step === 'name') {
      if (key.return && name.trim()) {
        setStep('transport');
        return;
      }
      if (key.backspace || key.delete) {
        setName((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setName((prev) => prev + input);
      }
      return;
    }

    if (step === 'transport') {
      if (key.upArrow || key.downArrow) {
        setTransportIdx((prev) => (prev === 0 ? 1 : 0));
        setTransport(transportIdx === 0 ? 'stdio' : 'http');
        return;
      }
      if (key.return) {
        setTransport(transportIdx === 0 ? 'http' : 'stdio');
        setStep('details');
        return;
      }
      return;
    }

    if (step === 'details') {
      if (key.return) {
        const value = transport === 'http' ? url.trim() : command.trim();
        if (value) {
          if (transport === 'http') {
            onAdd(name.trim(), { transport: 'http', url: url.trim() });
          } else {
            const parts = command.trim().split(/\s+/);
            onAdd(name.trim(), { transport: 'stdio', command: parts[0], args: parts.slice(1) });
          }
          setStep('done');
        }
        return;
      }
      if (key.backspace || key.delete) {
        if (transport === 'http') setUrl((prev) => prev.slice(0, -1));
        else setCommand((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        if (transport === 'http') setUrl((prev) => prev + input);
        else setCommand((prev) => prev + input);
      }
      return;
    }

    // done step
    if (key.return || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(`  ${box.topLeft}${'─ Add Server '}${'─'.repeat(Math.max(0, boxWidth - 13))}${box.topRight}`)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {step === 'method' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('How would you like to add?')}
            {' '.repeat(Math.max(1, boxWidth - 30))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {methodIdx === 0 ? colors.accent(symbols.selected) : ' '}{' '}
            {methodIdx === 0 ? colors.textBold('Paste JSON') : colors.textPrimary('Paste JSON')}
            {' '.repeat(Math.max(1, boxWidth - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}    `)}
            {colors.textSecondary('From your mcp.json config')}
            {' '.repeat(Math.max(1, boxWidth - 31))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {methodIdx === 1 ? colors.accent(symbols.selected) : ' '}{' '}
            {methodIdx === 1 ? colors.textBold('Enter details') : colors.textPrimary('Enter details')}
            {' '.repeat(Math.max(1, boxWidth - 19))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}    `)}
            {colors.textSecondary('Fill in step by step')}
            {' '.repeat(Math.max(1, boxWidth - 26))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {step === 'paste-json' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Name:       ')}
            {colors.textPrimary(name)}
            {!name.trim() ? colors.accent('|') : ''}
            {' '.repeat(Math.max(1, boxWidth - name.length - (name.trim() ? 16 : 17)))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('JSON:       ')}
            {colors.textPrimary(
              jsonInput.length > boxWidth - 20 ? jsonInput.slice(0, boxWidth - 23) + '...' : jsonInput,
            )}
            {name.trim() ? colors.accent('|') : ''}
            {' '.repeat(Math.max(1, boxWidth - Math.min(jsonInput.length, boxWidth - 20) - (name.trim() ? 17 : 16)))}
            {colors.brandMid(box.vertical)}
          </Text>
          {jsonError && (
            <Text>
              {colors.brandMid(`  ${box.vertical}  `)}
              {colors.error(jsonError)}
              {' '.repeat(Math.max(1, boxWidth - jsonError.length - 4))}
              {colors.brandMid(box.vertical)}
            </Text>
          )}
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim('Paste your server config object from mcp.json')}
            {' '.repeat(Math.max(1, boxWidth - 50))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim('e.g. {"url":"https://...","headers":{}}')}
            {' '.repeat(Math.max(1, boxWidth - 43))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {step === 'name' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Name:       ')}
            {colors.textPrimary(name)}
            {colors.accent('|')}
            {' '.repeat(Math.max(1, boxWidth - name.length - 17))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim('Enter a unique name for this server (e.g. my-gitlab)')}
            {' '.repeat(Math.max(1, boxWidth - 54))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {step === 'transport' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(`Name:       ${name}`)}
            {' '.repeat(Math.max(1, boxWidth - name.length - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Transport:')}
            {' '.repeat(Math.max(1, boxWidth - 13))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {transportIdx === 0 ? colors.accent(symbols.selected) : ' '}{' '}
            {transportIdx === 0 ? colors.textBold('HTTP (Streamable)') : 'HTTP (Streamable)'}
            {' '.repeat(Math.max(1, boxWidth - 24))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {transportIdx === 1 ? colors.accent(symbols.selected) : ' '}{' '}
            {transportIdx === 1 ? colors.textBold('Stdio (command)') : 'Stdio (command)'}
            {' '.repeat(Math.max(1, boxWidth - 22))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {step === 'details' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(`Name:       ${name}`)}
            {' '.repeat(Math.max(1, boxWidth - name.length - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(`Transport:  ${transport === 'http' ? 'HTTP (Streamable)' : 'Stdio'}`)}
            {' '.repeat(Math.max(1, boxWidth - (transport === 'http' ? 32 : 19)))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(transport === 'http' ? 'URL:        ' : 'Command:    ')}
            {colors.textPrimary(transport === 'http' ? url : command)}
            {colors.accent('|')}
            {' '.repeat(Math.max(1, boxWidth - (transport === 'http' ? url : command).length - 17))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim(
              transport === 'http' ? 'e.g. https://git.example.com/api/v4/mcp' : 'e.g. uvx elasticsearch-mcp-server',
            )}
            {' '.repeat(Math.max(1, boxWidth - (transport === 'http' ? 43 : 35)))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {step === 'done' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.success(`${symbols.success} Server "${name}" added successfully`)}
            {' '.repeat(Math.max(1, boxWidth - name.length - 34))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(`Type:  ${transport === 'http' ? 'HTTP (Streamable)' : 'Stdio'}`)}
            {' '.repeat(Math.max(1, boxWidth - (transport === 'http' ? 26 : 13)))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(transport === 'http' ? `URL:   ${url}` : `Cmd:   ${command}`)}
            {' '.repeat(Math.max(1, boxWidth - (transport === 'http' ? url : command).length - 11))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {step === 'done' ? colors.accentDim('[enter] back to dashboard') : colors.accentDim('enter next │ esc back')}
        {' '.repeat(Math.max(1, boxWidth - (step === 'done' ? 28 : 24)))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
