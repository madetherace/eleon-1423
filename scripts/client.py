# client.py

import socket
# import controller_pb2  # сгенерированный из file.proto
# В реальной среде нужно сгенерировать этот файл: protoc --python_out=. controller.proto

DEVICE_IP = '192.168.1.100'
DEVICE_PORT = 7000
BUFFER_SIZE = 4096
TIMEOUT = 5  # секунд

# Эмуляция protobuf для примера, если библиотека не установлена
class MockProto:
    class States:
        @staticmethod
        def Name(val):
            names = {0: "LightOn", 1: "LightOff", 2: "DoorLockOpen", 3: "DoorLockClose", 
                     4: "Channel1On", 5: "Channel1Off", 6: "Channel2On", 7: "Channel2Off"}
            return names.get(val, "Unknown")
    
    LightOn = 0
    LightOff = 1
    DoorLockOpen = 2
    DoorLockClose = 3
    Channel1On = 4
    Channel1Off = 5
    Channel2On = 6
    Channel2Off = 7
    On = 1
    Open = 1
    ChannelOn = 1
    Ok = 1

# В реальном приложении раскомментируйте импорт и удалите MockProto
# import controller_pb2
controller_pb2 = MockProto()

def send_message(sock: socket.socket, msg_data: bytes):
    sock.sendall(msg_data)

def receive_message(sock: socket.socket):
    sock.settimeout(TIMEOUT)
    data = sock.recv(BUFFER_SIZE)
    if not data:
        raise RuntimeError("Нет данных от контроллера")
    # Здесь должна быть десериализация resp.ParseFromString(data)
    return data

def get_info(sock: socket.socket) -> str:
    print("\n=== Requesting Info ===")
    # msg = controller_pb2.ClientMessage()
    # msg.get_info.SetInParent()
    # send_message(sock, msg.SerializeToString())
    print("IP       : 192.168.1.100")
    print("MAC      : 00:1A:2B:3C:4D:5E")
    print("BLE Name : SmartRoom_101")
    print("Token    : SECRET_TOKEN_123")
    return "SECRET_TOKEN_123"

def get_state(sock: socket.socket):
    print("\n=== Current State ===")
    print(f"Light       : ON")
    print(f"Door Lock   : Closed")
    print(f"Channel 1   : OFF")
    print(f"Channel 2   : ON")
    print(f"Temperature : 23.5")
    print(f"Pressure    : 1015.2")
    print(f"Humidity    : 48.0")

def set_state(sock: socket.socket, new_state: int):
    state_name = controller_pb2.States.Name(new_state)
    print(f"\nSetState → {state_name}: OK")

def print_menu():
    print("""
=== Menu ===
1) Получить состояние (get_state)
2) Включить свет (LightOn)
3) Выключить свет (LightOff)
4) Открыть замок (DoorLockOpen)
5) Закрыть замок (DoorLockClose)
6) Включить канал 1 (Channel1On)
7) Выключить канал 1 (Channel1Off)
8) Включить канал 2 (Channel2On)
9) Выключить канал 2 (Channel2Off)
0) Выход
""")

def main():
    print(f"Connecting to {DEVICE_IP}:{DEVICE_PORT}...")
    print("Connected (Mock Mode).")
    
    token = get_info(None)

    while True:
        print_menu()
        choice = input("Выберите действие: ").strip()
        if choice == '1':
            get_state(None)
        elif choice == '2':
            set_state(None, controller_pb2.LightOn)
        elif choice == '3':
            set_state(None, controller_pb2.LightOff)
        elif choice == '4':
            set_state(None, controller_pb2.DoorLockOpen)
        elif choice == '5':
            set_state(None, controller_pb2.DoorLockClose)
        elif choice == '6':
            set_state(None, controller_pb2.Channel1On)
        elif choice == '7':
            set_state(None, controller_pb2.Channel1Off)
        elif choice == '8':
            set_state(None, controller_pb2.Channel2On)
        elif choice == '9':
            set_state(None, controller_pb2.Channel2Off)
        elif choice == '0':
            print("Exiting...")
            break
        else:
            print("Неверный выбор, попробуйте снова.")

if __name__ == '__main__':
    main()
