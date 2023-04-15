import dedent from 'dedent';
import { useEffect, useRef, useState } from 'react';
import EllipsisHorizontalIcon from './assets/icons/ellipsis-horizontal';
import EyeIcon from './assets/icons/eye';
import EyeSlashIcon from './assets/icons/eye-slash';
import PaperAirplaneIcon from './assets/icons/paper-airplane';
import Select, { Option } from './components/select';

type Message = {
  role: 'system' | 'assistant' | 'user';
  content: string;
};

const getSystemMessage = (): Message => ({
  role: 'system',
  content: dedent(`
    You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.
    Knowledge cutoff: 2021-09-01
    Current date: ${new Date().toISOString().split('T')[0]}
  `),
});

const parseJson = (str: string) => {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
};

function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const [apiKey, setApiKey] = useState('');
  const [apiKeyTemp, setApiKeyTemp] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const [model, setModel] = useState('');
  const [modelTemp, setModelTemp] = useState('');
  const [possibleModels, setPossibleModels] = useState<string[]>([]);
  const [showModelModal, setShowModelModal] = useState(false);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setShowApiKeyModal(true);
    }
  }, [apiKey]);

  useEffect(() => {
    const defaultModel =
      possibleModels.find((model) => model === 'gpt-3.5-turbo') ?? possibleModels.at(-1) ?? '';
    setModel(defaultModel);
    setModelTemp(defaultModel);
  }, [possibleModels]);

  useEffect(() => {
    if (messages.length === 0) {
      const systemMessage = getSystemMessage();
      setMessages([systemMessage]);
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '1rem';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;

      if (textareaRef.current.scrollHeight > 256) {
        textareaRef.current.style.height = '256px';
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [inputText]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (isLoading) {
      return;
    }

    const inputMessages = [
      getSystemMessage(),
      ...messages.slice(1),
      { role: 'user' as const, content: inputText },
    ];

    setMessages(inputMessages);
    setInputText('');
    setIsLoading(true);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: inputMessages,
        stream: true,
      }),
    });

    if (response.status !== 200) {
      const { error } = await response.json();

      if (error.code === 'context_length_exceeded') {
        alert('대화가 너무 길어져서 ChatGPT가 고장났어요.');
      } else if (response.status === 429) {
        alert('API 요청 제한을 초과했어요.\nOpenAI 계정에 결제 정보가 등록되었는지 확인해주세요.');
      } else {
        alert(error.message);
      }

      setMessages(inputMessages.slice(0, inputMessages.length - 1));
      setIsLoading(false);

      return;
    }

    if (!response.body) {
      throw new Error();
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

    const responseMessage = {
      role: 'assistant' as const,
      content: '',
    };

    setMessages([...inputMessages, responseMessage]);

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      for (const data of value.split('data: ')) {
        const delta = parseJson(data)?.choices?.[0]?.delta?.content;
        if (delta) {
          responseMessage.content += delta;
          setMessages([...inputMessages, responseMessage]);
        }
      }
    }

    setIsLoading(false);
  };

  return (
    <>
      <div className="h-screen flex">
        {/* 사이드바 */}
        <div className="w-64 h-full bg-neutral-800 p-4 flex flex-col justify-end items-center">
          <div className="w-full h-0 border-b-[1px] border-neutral-600 mb-4" />

          <button
            className="w-full flex flex-col items-center font-mono mb-4"
            onClick={() => {
              setShowModelModal(true);
            }}
          >
            <p className="text-white">Model</p>
            <p className="text-neutral-400">{model}</p>
          </button>

          <div className="w-full h-0 border-b-[1px] border-neutral-600 mb-4" />

          {apiKey && (
            <>
              <button
                className="w-full flex flex-col items-center font-mono mb-4"
                onClick={() => {
                  setShowApiKey(false);
                  setShowApiKeyModal(true);
                }}
              >
                <p className="text-white">API Key</p>
                <p className="text-neutral-400">
                  {apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4)}
                </p>
              </button>

              <div className="w-full h-0 border-b-[1px] border-neutral-600" />
            </>
          )}
        </div>

        {/* 채팅창 + 입력창 */}
        <div className="flex-1 h-full flex flex-col">
          {/* 채팅창 */}
          <div className="flex-1 overflow-scroll" ref={chatWindowRef}>
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <div key={index} className="bg-neutral-100 px-6 py-4">
                  <p className="break-word whitespace-pre-wrap">{message.content.trim()}</p>
                </div>
              ) : message.role === 'assistant' ? (
                <div key={index} className="bg-neutral-200 px-6 py-4 flex">
                  <p className="ml-2 break-word whitespace-pre-wrap">
                    {'👉 ' + message.content.trim()}
                  </p>
                </div>
              ) : null,
            )}
          </div>

          {/* 입력창 */}
          <div className="w-full bg-neutral-500 p-4 flex items-center">
            <textarea
              className="flex-1 resize-none p-4 rounded-l"
              ref={textareaRef}
              value={inputText}
              placeholder="ChatGPT에게 질문해보세요."
              onChange={(e) => {
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  sendMessage();
                }
              }}
            />
            <button
              className="w-16 h-full rounded-r bg-white flex items-center justify-center"
              onClick={sendMessage}
            >
              {isLoading ? (
                <EllipsisHorizontalIcon className="w-6 h-6 text-neutral-800" />
              ) : (
                <PaperAirplaneIcon className="w-6 h-6 text-neutral-800" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 모델 선택 모달 */}
      {showModelModal && (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/50 flex items-center justify-center">
          <div className="w-4/5 max-w-sm bg-white px-8 py-6 rounded-lg flex flex-col items-center relative">
            <p>사용할 모델을 선택해주세요.</p>
            <Select
              className="w-full h-12 mt-6"
              options={possibleModels.map((model) => ({ label: model, value: model }))}
              defaultOption={{ label: model, value: model }}
              placeholder="Select model"
              onChange={(option: Option) => {
                setModelTemp(option.value);
              }}
            />
            <button
              className="w-16 h-8 rounded bg-green-600 disabled:opacity-70 mt-6"
              disabled={!modelTemp}
              onClick={async () => {
                setModel(modelTemp);
                setShowModelModal(false);
              }}
            >
              <p className="text-xs text-white">확인</p>
            </button>
            <button
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center"
              onClick={() => {
                setShowModelModal(false);
              }}
            >
              <img className="w-4 h-4" src="https://www.svgrepo.com/show/507886/x-alt.svg" />
            </button>
          </div>
        </div>
      )}

      {/* API Key 입력 모달 */}
      {showApiKeyModal && (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black/50 flex items-center justify-center">
          <div className="w-4/5 max-w-sm bg-white px-8 py-6 rounded-lg flex flex-col items-center relative">
            <p>OpenAI API Key를 입력해주세요.</p>
            <a
              className="text-neutral-500 text-xs underline mt-2"
              href="https://jongwan56.notion.site/OpenAI-API-Key-d671160525e94ed68f2f8b812b98ce9a"
              target="_blank"
            >
              API Key가 뭔가요...?
            </a>
            <div className="w-full h-8 mt-6 flex items-center">
              <input
                className="flex-1 h-full rounded-l pl-2 border-[1px] border-r-0 border-neutral-300 text-xs"
                value={apiKeyTemp}
                type={showApiKey ? 'text' : 'password'}
                onChange={(e) => {
                  setApiKeyTemp(e.target.value);
                }}
              />
              <button
                className="w-10 h-full bg-white rounded-r border-[1px] border-l-0 border-neutral-300 flex justify-center items-center"
                onClick={() => {
                  setShowApiKey((prev) => !prev);
                }}
              >
                {showApiKey ? (
                  <EyeIcon className="w-4 h-4 text-neutral-400" />
                ) : (
                  <EyeSlashIcon className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
            <button
              className="w-16 h-8 rounded bg-green-600 disabled:opacity-70 mt-6"
              disabled={apiKeyLoading || !apiKeyTemp}
              onClick={async () => {
                if (!apiKeyTemp) {
                  return;
                }

                setApiKeyLoading(true);

                try {
                  const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${apiKeyTemp}` },
                  });

                  const data = (await response.json()).data as { id: string }[];

                  const models = data
                    .filter((model) => model.id.includes('gpt-'))
                    .map((model) => model.id);

                  setApiKey(apiKeyTemp);
                  setApiKeyTemp('');
                  setPossibleModels(models);
                  setShowApiKey(false);
                  setShowApiKeyModal(false);
                } catch {
                  alert('API Key를 다시 확인해주세요!');
                } finally {
                  setApiKeyLoading(false);
                }
              }}
            >
              <p className="text-xs text-white">{apiKeyLoading ? '확인 중' : '확인'}</p>
            </button>
            {apiKey && (
              <button
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center"
                onClick={() => {
                  setApiKeyTemp('');
                  setShowApiKeyModal(false);
                  setShowApiKey(false);
                }}
              >
                <img className="w-4 h-4" src="https://www.svgrepo.com/show/507886/x-alt.svg" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
