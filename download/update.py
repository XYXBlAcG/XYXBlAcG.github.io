import requests
import os
import sys

def chk_upd(current_version):
    try:
        respons = requests.get('http://127.0.0.1:5500/download/check_for_update')
        lateset_version = respons.text.strip()
        if lateset_version != current_version:
            return lateset_version
        else:
            return None
    except Exception as e:
        print("检查更新时出错：", e)
        return None

def download_upd():
    try:
        respons = requests.get('http://127.0.0.1:5500/download/update.py')
        with open('update.py', 'wb') as f:
            f.write(respons.content)
        return True
    except Exception as e:
        print("下载更新时出错：", e)
        return False

def replace_version():
    try:
        os.replace('update.py', sys.argv[0])
        return True
    except Exception as e:
        print("替换当前版本时出错：", e)
        return False

if __name__ == "__main__":
    client_version = "1.1"  # 当前版本号
    lateset_version = chk_upd(client_version)
    if lateset_version:
        print("有新版本可用：", lateset_version)
        if download_upd():
            print("更新已成功下载。")
            if replace_version():
                print("更新成功。请重新启动程序。")
            else:
                print("无法替换当前版本。")
        else:
            print("下载更新失败。")
    else:
        print("您已经在使用最新版本。")
