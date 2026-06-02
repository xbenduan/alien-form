import { PlusOutlined } from '@ant-design/icons';
import { Input, Tag } from 'antd';
import { useState } from 'react';

interface TagsInputProps {
  value?: string[];
  onChange?: (nextValue: string[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  format?: string;
}

export function TagsInput({
  value = [],
  onChange,
  disabled,
  readOnly,
  placeholder = '输入后按 Enter',
  format,
}: TagsInputProps) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleClose = (removedTag: string) => {
    const nextTags = value.filter((item) => item !== removedTag);
    onChange?.(nextTags);
  };

  const handleInputConfirm = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !value.includes(trimmedValue)) {
      onChange?.([...value, trimmedValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {value.map((tag) => (
        <Tag
          key={tag}
          closable={!disabled}
          onClose={() => handleClose(tag)}
          style={{ paddingInline: 8, paddingBlock: 2 }}
        >
          {tag}
        </Tag>
      ))}
      {!disabled ? (
        inputVisible ? (
          <Input
            type="text"
            size="small"
            style={{ width: 120 }}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onBlur={handleInputConfirm}
            onPressEnter={handleInputConfirm}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <Tag
            onClick={() => setInputVisible(true)}
            style={{ borderStyle: 'dashed', cursor: 'pointer' }}
          >
            <PlusOutlined /> 添加
          </Tag>
        )
      ) : null}
    </div>
  );
}
