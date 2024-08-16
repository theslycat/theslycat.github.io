---
title: How to detect sandbox 如何检测程序是否在沙箱中运行
categories: [Malware]

---


Today, in hornor, I'm about to bring you guz a tutorial on 2 methods(one local one remote) to detect whether your malware is running under a sandbox, thus to avoid being terminated or spotted.

### CORE METHODOLOGY
In most of the sandboxes, in order to avoid taking system resources beyond expectaion, functions that enable programs to pause for a period(such as Sleep()) will be accelerated.
On the basis of this fundemental fact, a bunch of sandbox detection mechanism was developed. In this article I'll present some practical ones for you and explain in detail.

### NTP Time Base
This mechanism uses NTP(Network Time Protocal) protocal to determine whether sleep was accelerated.
The service is provided by Mircrosoft so no suspicious traffic will be spotted. (time.windows.com)
#### udp package
The standard format is here: https://www.rfc-editor.org/rfc/rfc5905
And you can use available thirdparty libs, You know how to Github right >^<

#### Pseudo Code

A sample pseudo code is like:

```go
startTime := GetNTPTime()
var isSandBox bool = false
var DURATION int = 100 * Time.Second
time.Sleep(DURATION)
if (GetNTPTime() - startTime < DURATION) {
    isSandBox = true
}

return isSandbox
```

See, that simple.



### Thread Synchronize Event

This detection mechanism is implemented by Windows Thread Synchronization Event. We can set up an Event, pass it into a new thread where the program shall sleep for X seconds and activate the Event. In main thread, WaitForSingleObject() is called to wait the Event in a particular period of time(less than actual sleep time), if timeout, then NOT a sandbox.

```c
void waitfunc(PHANDLE p) {
    Sleep(10000);
    SetEvent(*p);
}

BOOL isSandbox() {
    HANDLE eHandle = CreateEvent(NULL, TRUE, FALSE, NULL);
    DWORD timeout = 9000;
    HANDLE hThread = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)func, &eHandle, 0, NULL);
    if (WaitForSingleObject(eHandle ,timeout) == WAIT_TIMEOUT) {
        return FALSE
    }
    return TRUE
}
int main() {
    if(isSandbox()) return 1;
    // do sth.
    return 0;
}

```





More things like this is about to come out. >o< Feel free to ask if you meet and problems.
