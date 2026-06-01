import React, { useState, useRef } from "react";
import { Tag, Input } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface TagsInputProps {
  value?: string[];
  onChange?: (v: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const TagsInput: React.FC<TagsInputProps> = ({
  value = [],
  onChange,
  disabled,
  placeholder = "输入后按 Enter",
}) => {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<any>(null);

  const handleClose = (removedTag: string) => {
    const newTags = value.filter((t) => t !== removedTag);
    onChange?.(newTags);
  };

  const handleInputConfirm = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange?.([...value, trimmed]);
    }
    setInputVisible(false);
    setInputValue("");
  };

  const showInput = () => {
    setInputVisible(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {value.map((tag) => (
        <Tag
          key={tag}
          closable={!disabled}
          onClose={() => handleClose(tag)}
          className="px-2 py-0.5"
        >
          {tag}
        </Tag>
      ))}
      {!disabled && (
        inputVisible ? (
          <Input
            ref={inputRef}
            type="text"
            size="small"
            className="w-24"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputConfirm}
            onPressEnter={handleInputConfirm}
            placeholder={placeholder}
          />
        ) : (
          <Tag onClick={showInput} className="border-dashed cursor-pointer">
            <PlusOutlined /> 添加
          </Tag>
        )
      )}
    </div>
  );
};
