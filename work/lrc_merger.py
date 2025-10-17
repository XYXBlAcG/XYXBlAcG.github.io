def parse_lrc(file_path):
    """解析 LRC 文件，返回时间戳和歌词的字典"""
    lyrics = {}
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            for line in file:
                line = line.strip()
                if line.startswith('[') and ']' in line:
                    # 提取时间戳和歌词
                    time_start = line.find('[')
                    time_end = line.find(']')
                    timestamp = line[time_start+1:time_end]
                    lyric = line[time_end+1:].strip()
                    
                    # 只处理包含时间戳的行
                    if ':' in timestamp and '.' in timestamp:
                        # 将时间戳转换为秒数，用作排序键
                        minutes, seconds = timestamp.split(':')
                        total_seconds = float(minutes) * 60 + float(seconds)
                        lyrics[total_seconds] = lyric
    except FileNotFoundError:
        print(f"找不到文件: {file_path}")
        return {}
    except Exception as e:
        print(f"处理文件时出错: {e}")
        return {}
    
    return lyrics

def merge_lyrics(original_path, translation_path, output_path):
    """合并原文和翻译歌词，生成新的文本文件"""
    # 解析两个 LRC 文件
    original_lyrics = parse_lrc(original_path)
    translation_lyrics = parse_lrc(translation_path)
    
    # 获取所有时间戳并排序
    timestamps = sorted(set(list(original_lyrics.keys()) + list(translation_lyrics.keys())))
    
    try:
        with open(output_path, 'w', encoding='utf-8') as output_file:
            for time in timestamps:
                # 转换时间戳回原格式
                minutes = int(time // 60)
                seconds = time % 60
                timestamp = f"[{minutes:02d}:{seconds:05.2f}]"
                
                # 获取对应时间戳的原文和翻译
                original = original_lyrics.get(time, '')
                translation = translation_lyrics.get(time, '')
                
                # 写入带时间戳的歌词
                if original:
                    output_file.write(f"{timestamp}{original}\n")
                if translation:
                    output_file.write(f"{timestamp}{translation}\n")
        
        print(f"合并完成！输出文件：{output_path}")
        
    except Exception as e:
        print(f"写入输出文件时出错: {e}")

def clean_path(path):
    """清理文件路径，移除多余的引号和空格"""
    return path.strip().strip('"').strip("'").strip()

def main():
    print("提示：你可以直接将文件拖入终端窗口来输入路径")
    # 获取用户输入并清理路径
    original_path = clean_path(input("请输入原文歌词文件路径: "))
    translation_path = clean_path(input("请输入翻译歌词文件路径: "))
    output_path = clean_path(input("请输入输出文件路径: "))
    
    # 检查输入文件是否存在
    if not os.path.exists(original_path):
        print(f"错误：找不到原文歌词文件：{original_path}")
        return
    if not os.path.exists(translation_path):
        print(f"错误：找不到翻译歌词文件：{translation_path}")
        return
    
    # 合并歌词
    merge_lyrics(original_path, translation_path, output_path)

# 添加必要的导入
import os

if __name__ == "__main__":
    main()